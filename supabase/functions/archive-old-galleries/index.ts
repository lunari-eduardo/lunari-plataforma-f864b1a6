import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

// ============ R2 helpers (AWS Signature V4) ============
async function sha256Hex(data: ArrayBuffer | Uint8Array | string): Promise<string> {
  const buf = typeof data === 'string' ? new TextEncoder().encode(data) : data;
  const h = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(h)).map((b) => b.toString(16).padStart(2, '0')).join('');
}
async function hmac(key: ArrayBuffer | Uint8Array, data: string): Promise<ArrayBuffer> {
  const cryptoKey = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(data));
}
async function hmacHex(key: ArrayBuffer, data: string): Promise<string> {
  const sig = await hmac(key, data);
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, '0')).join('');
}
async function getSigningKey(secret: string, dateStamp: string, region: string, service: string): Promise<ArrayBuffer> {
  const kDate = await hmac(new TextEncoder().encode('AWS4' + secret), dateStamp);
  const kRegion = await hmac(kDate, region);
  const kService = await hmac(kRegion, service);
  return hmac(kService, 'aws4_request');
}
async function deleteFromR2(
  accountId: string, accessKeyId: string, secret: string, bucket: string, key: string,
): Promise<boolean> {
  try {
    const host = `${accountId}.r2.cloudflarestorage.com`;
    const date = new Date();
    const amzDate = date.toISOString().replace(/[:-]|\.\d{3}/g, '');
    const dateStamp = amzDate.slice(0, 8);
    const region = 'auto';
    const service = 's3';
    const canonicalUri = `/${bucket}/${key}`;
    const payloadHash = await sha256Hex('');
    const canonicalHeaders = `host:${host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${amzDate}\n`;
    const signedHeaders = 'host;x-amz-content-sha256;x-amz-date';
    const canonicalRequest = ['DELETE', canonicalUri, '', canonicalHeaders, signedHeaders, payloadHash].join('\n');
    const algorithm = 'AWS4-HMAC-SHA256';
    const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
    const stringToSign = [algorithm, amzDate, credentialScope, await sha256Hex(canonicalRequest)].join('\n');
    const signingKey = await getSigningKey(secret, dateStamp, region, service);
    const signature = await hmacHex(signingKey, stringToSign);
    const authorization = `${algorithm} Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
    const res = await fetch(`https://${host}${canonicalUri}`, {
      method: 'DELETE',
      headers: {
        'x-amz-content-sha256': payloadHash,
        'x-amz-date': amzDate,
        Authorization: authorization,
      },
    });
    return res.ok || res.status === 204 || res.status === 404;
  } catch (e) {
    console.error(`[archive-old-galleries] R2 delete failed for ${key}:`, e);
    return false;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Usando Service Role para rodar como CRON Admin
    const supabaseAdmin = createClient(supabaseUrl, serviceKey);

    // Proteção básica para garantir que a rota não seja acessada publicamente a não ser com service_key.
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || authHeader !== `Bearer ${serviceKey}`) {
        // Log para debug
        console.warn("[archive-old-galleries] auth header did not match service key. Skipping for security.");
        return new Response(JSON.stringify({ success: false, error: 'Unauthorized, must use service key' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // 1. Encontrar galerias confirmadas há mais de 180 dias
    const { data: galeriasVencidas, error: dbErr } = await supabaseAdmin
      .from('galerias')
      .select('id, user_id')
      .in('status', ['finalizada', 'selection_completed'])
      .lt('finalized_at', new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString())
      .limit(20);

    if (dbErr) {
      throw new Error(`DB Error fetching old galleries: ${dbErr.message}`);
    }

    if (!galeriasVencidas || galeriasVencidas.length === 0) {
      return new Response(JSON.stringify({ success: true, processed: 0, message: "No old galleries found." }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const accountId = Deno.env.get('R2_ACCOUNT_ID');
    const accessKey = Deno.env.get('R2_ACCESS_KEY_ID');
    const secretKey = Deno.env.get('R2_SECRET_ACCESS_KEY');
    const bucket = 'lunari-previews';
    
    let totalR2Deleted = 0;
    let totalProcessed = 0;
    const errorsList: any[] = [];

    for (const galeria of galeriasVencidas) {
        try {
            // Chamamos a mesma RPC archive_gallery, mas usando o token Service Role.
            // Precisamos garantir que a RPC permita execução com o service_role e contorne a validação auth.uid().
            // Se a RPC falhar por validação de userId, falhará aqui. 
            // Porém o trigger `trg_archive_gallery_on_delete` criado vai fazer o papel do arquivamento se usarmos DELETE.
            // Para não quebrar caso archive_gallery tenha RLS, usaremos o DELETE nativo que acionará o trigger + buscar paths
            
            // Mas espera, como buscar os arquivos do R2 se deletarmos do banco primeiro?
            // Vamos ler a tabela de arquivos ou usar a rpc `archive_gallery` que deve suportar service_role.
            const { data: archiveResult, error: rpcErr } = await supabaseAdmin.rpc('archive_gallery', { p_gallery_id: galeria.id });
            
            if (rpcErr) {
                // Se o RPC não permitir admin, caímos para deleção manual:
                console.error(`[archive-old-galleries] RPC error for ${galeria.id}:`, rpcErr);
                errorsList.push({ id: galeria.id, err: rpcErr.message });
                continue;
            }

            const result = archiveResult as any;
            const paths = Array.isArray(result?.paths_to_purge) ? result.paths_to_purge : [];
            let deletedFromStorage = 0;

            if (accountId && accessKey && secretKey && paths.length > 0) {
              for (let i = 0; i < paths.length; i += 20) {
                const chunk = paths.slice(i, i + 20);
                const results = await Promise.all(chunk.map((p) =>
                  deleteFromR2(accountId, accessKey, secretKey, bucket, p).then((ok) => ({ p, ok })),
                ));
                for (const r of results) {
                  if (r.ok) deletedFromStorage++;
                }
              }
            }

            // O `archive_gallery` do banco possivelmente já deletou a galeria.
            // O Trigger fará o backup para `galerias_arquivadas`.
            totalR2Deleted += deletedFromStorage;
            totalProcessed++;

        } catch(err: any) {
            console.error(`Error processing gallery ${galeria.id}:`, err);
            errorsList.push({ id: galeria.id, err: err.message });
        }
    }

    return new Response(JSON.stringify({ 
        success: true, 
        processed: totalProcessed, 
        r2Deleted: totalR2Deleted, 
        errors: errorsList 
    }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Internal error';
    console.error('[archive-old-galleries] fatal:', e);
    return new Response(JSON.stringify({ success: false, error: msg }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
