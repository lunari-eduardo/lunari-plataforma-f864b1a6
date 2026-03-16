/**
 * R2 Media Upload Edge Function
 * 
 * Uploads media files (images, videos) to Cloudflare R2 for blog/content/tasks.
 * Uses the same R2 bucket (lunari-previews) as Gallery, with `media/` prefix.
 * No credit system — just auth + upload + return CDN URL.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CDN_BASE = "https://media.lunarihub.com";
const R2_BUCKET = "lunari-previews";
const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_VIDEO_SIZE = 50 * 1024 * 1024; // 50MB

// ── AWS Sig V4 Helpers ───────────────────────────────────────────────────────

async function sha256Hex(data: ArrayBuffer | Uint8Array | string): Promise<string> {
  const buffer = typeof data === 'string' 
    ? new TextEncoder().encode(data) 
    : data;
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

async function hmac(key: ArrayBuffer, data: string): Promise<ArrayBuffer> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  return crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(data));
}

async function hmacHex(key: ArrayBuffer, data: string): Promise<string> {
  const sig = await hmac(key, data);
  return Array.from(new Uint8Array(sig))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

async function getSignatureKey(
  key: string, dateStamp: string, region: string, service: string
): Promise<ArrayBuffer> {
  const kDate = await hmac(new TextEncoder().encode('AWS4' + key), dateStamp);
  const kRegion = await hmac(kDate, region);
  const kService = await hmac(kRegion, service);
  return hmac(kService, 'aws4_request');
}

async function uploadToR2(
  accountId: string,
  accessKeyId: string,
  secretAccessKey: string,
  bucketName: string,
  key: string,
  body: ArrayBuffer,
  contentType: string
): Promise<void> {
  const host = `${accountId}.r2.cloudflarestorage.com`;
  const url = `https://${host}/${bucketName}/${key}`;
  
  const date = new Date();
  const amzDate = date.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = amzDate.slice(0, 8);
  const region = 'auto';
  const service = 's3';
  const canonicalUri = `/${bucketName}/${key}`;
  
  const payloadHash = await sha256Hex(body);
  
  const canonicalHeaders = [
    `content-type:${contentType}`,
    `host:${host}`,
    `x-amz-content-sha256:${payloadHash}`,
    `x-amz-date:${amzDate}`,
  ].join('\n') + '\n';
  
  const signedHeaders = 'content-type;host;x-amz-content-sha256;x-amz-date';
  
  const canonicalRequest = [
    'PUT', canonicalUri, '', canonicalHeaders, signedHeaders, payloadHash,
  ].join('\n');
  
  const algorithm = 'AWS4-HMAC-SHA256';
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const canonicalRequestHash = await sha256Hex(canonicalRequest);
  const stringToSign = [algorithm, amzDate, credentialScope, canonicalRequestHash].join('\n');
  
  const signingKey = await getSignatureKey(secretAccessKey, dateStamp, region, service);
  const signature = await hmacHex(signingKey, stringToSign);
  const authorization = `${algorithm} Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
  
  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      'Content-Type': contentType,
      'x-amz-content-sha256': payloadHash,
      'x-amz-date': amzDate,
      'Authorization': authorization,
    },
    body,
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`R2 upload failed: ${response.status} - ${error}`);
  }
}

async function uploadToR2WithRetry(
  accountId: string, accessKeyId: string, secretAccessKey: string,
  bucketName: string, key: string, body: ArrayBuffer, contentType: string,
  requestId: string
): Promise<void> {
  const delays = [0, 1000, 2000];
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      if (attempt > 0) {
        console.log(`[${requestId}] R2 retry ${attempt}/2, waiting ${delays[attempt]}ms`);
        await new Promise(r => setTimeout(r, delays[attempt]));
      }
      await uploadToR2(accountId, accessKeyId, secretAccessKey, bucketName, key, body, contentType);
      return;
    } catch (err) {
      console.error(`[${requestId}] R2 attempt ${attempt + 1} failed:`, err);
      if (attempt === 2) throw err;
    }
  }
}

// ── Main Handler ─────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  const requestId = crypto.randomUUID().slice(0, 8);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // ── 1. Auth ──────────────────────────────────────────────────────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Token inválido" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[${requestId}] User: ${user.id}`);

    // ── 2. Parse form data ───────────────────────────────────────────────────
    const formData = await req.formData();
    const file = formData.get("file") as File;
    const context = (formData.get("context") as string) || "general";

    if (!file) {
      return new Response(JSON.stringify({ error: "Arquivo é obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── 3. Validate file size ────────────────────────────────────────────────
    const isVideo = file.type.startsWith("video/");
    const maxSize = isVideo ? MAX_VIDEO_SIZE : MAX_IMAGE_SIZE;

    if (file.size > maxSize) {
      const limitMB = maxSize / (1024 * 1024);
      return new Response(
        JSON.stringify({ error: `Arquivo excede o limite de ${limitMB}MB` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── 4. R2 credentials ────────────────────────────────────────────────────
    const r2AccountId = Deno.env.get("R2_ACCOUNT_ID");
    const r2AccessKeyId = Deno.env.get("R2_ACCESS_KEY_ID");
    const r2SecretKey = Deno.env.get("R2_SECRET_ACCESS_KEY");

    if (!r2AccountId || !r2AccessKeyId || !r2SecretKey) {
      console.error(`[${requestId}] R2 credentials not configured`);
      return new Response(JSON.stringify({ error: "Configuração de storage incompleta" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── 5. Upload to R2 ─────────────────────────────────────────────────────
    const timestamp = Date.now();
    const randomId = crypto.randomUUID().slice(0, 8);
    const extension = file.name.split(".").pop()?.toLowerCase() || "bin";
    const filename = `${timestamp}-${randomId}.${extension}`;
    const storagePath = `media/${context}/${user.id}/${filename}`;

    const fileData = await file.arrayBuffer();

    console.log(`[${requestId}] Uploading: ${storagePath} (${(fileData.byteLength / 1024).toFixed(0)}KB)`);

    await uploadToR2WithRetry(
      r2AccountId, r2AccessKeyId, r2SecretKey, R2_BUCKET,
      storagePath, fileData, file.type || "application/octet-stream", requestId
    );

    const publicUrl = `${CDN_BASE}/${storagePath}`;

    console.log(`[${requestId}] ✓ Uploaded: ${publicUrl}`);

    return new Response(
      JSON.stringify({
        success: true,
        url: publicUrl,
        filename,
        storagePath,
        fileSize: fileData.byteLength,
        mimeType: file.type,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error(`[${requestId}] Error:`, error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
