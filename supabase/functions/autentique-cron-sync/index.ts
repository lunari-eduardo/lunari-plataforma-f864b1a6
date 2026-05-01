// Cron de sincronização automática com a Autentique.
// Roda periodicamente (ex: a cada 5 min) e atualiza todos os contratos
// que estão "enviado" e ainda não foram concluídos. Não exige config de
// webhook por parte do usuário.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const AUTENTIQUE_URL = "https://api.autentique.com.br/v2/graphql";
const MAX_CONTRATOS_POR_RUN = 200;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Pega contratos ativos (enviados na Autentique e ainda não finalizados)
    const { data: contratos, error: cErr } = await admin
      .from("contratos")
      .select("id, user_id, titulo, signature_external_id, status")
      .not("signature_external_id", "is", null)
      .in("status", ["enviado", "rascunho"])
      .order("updated_at", { ascending: true })
      .limit(MAX_CONTRATOS_POR_RUN);

    if (cErr) throw cErr;
    if (!contratos || contratos.length === 0) {
      return jres({ success: true, processed: 0, updated: 0 });
    }

    // Cache de api keys por user_id
    const keyCache = new Map<string, string | null>();
    async function getKey(userId: string): Promise<string | null> {
      if (keyCache.has(userId)) return keyCache.get(userId)!;
      const { data } = await admin
        .from("usuarios_integracoes")
        .select("access_token")
        .eq("user_id", userId)
        .eq("provedor", "autentique")
        .eq("status", "conectado")
        .maybeSingle();
      const key = data?.access_token || null;
      keyCache.set(userId, key);
      return key;
    }

    let updated = 0;
    let errors = 0;

    for (const contrato of contratos) {
      try {
        const apiKey = await getKey(contrato.user_id);
        if (!apiKey) continue;

        const result = await syncOne({ admin, apiKey, contrato });
        if (result.changed) updated++;
      } catch (e) {
        errors++;
        console.error("[autentique-cron-sync] erro contrato", contrato.id, e);
      }
    }

    return jres({
      success: true,
      processed: contratos.length,
      updated,
      errors,
    });
  } catch (e: any) {
    console.error("[autentique-cron-sync] fatal", e);
    return jres({ success: false, error: e?.message || "erro" }, 500);
  }
});

async function syncOne({
  admin,
  apiKey,
  contrato,
}: {
  admin: any;
  apiKey: string;
  contrato: { id: string; user_id: string; titulo: string; signature_external_id: string; status: string };
}) {
  const query = `
    query GetDocument($id: UUID!) {
      document(id: $id) {
        id name signed_count
        files { signed original }
        signatures {
          public_id name email
          signed { created_at }
          rejected { created_at }
          viewed { created_at }
          link { short_link }
          action { name }
        }
      }
    }
  `;

  const res = await fetch(AUTENTIQUE_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query, variables: { id: contrato.signature_external_id } }),
  });
  const json = await res.json().catch(() => ({} as any));
  if (!res.ok || json?.errors || !json?.data?.document) {
    return { changed: false };
  }

  const doc = json.data.document;
  const sigs: any[] = doc.signatures || [];
  const signersOut = sigs.map((s) => {
    let status: "assinado" | "recusado" | "visualizado" | "pendente" = "pendente";
    let timestamp: string | null = null;
    if (s.signed?.created_at) { status = "assinado"; timestamp = s.signed.created_at; }
    else if (s.rejected?.created_at) { status = "recusado"; timestamp = s.rejected.created_at; }
    else if (s.viewed?.created_at) { status = "visualizado"; timestamp = s.viewed.created_at; }
    return {
      public_id: s.public_id,
      email: s.email,
      nome: s.name,
      papel: s.action?.name,
      link: s.link?.short_link,
      status,
      timestamp,
    };
  });

  const allSigned = signersOut.length > 0 && signersOut.every((s) => s.status === "assinado");
  const anyRejected = signersOut.some((s) => s.status === "recusado");

  const patch: any = { signers: signersOut };

  if (anyRejected) {
    patch.status = "cancelado";
  } else if (allSigned) {
    patch.status = "assinado";
    const lastSigned = signersOut.map((s) => s.timestamp).filter(Boolean).sort().pop();
    patch.assinado_em = lastSigned || new Date().toISOString();

    const signedUrl = doc.files?.signed;
    if (signedUrl) {
      try {
        const pdfRes = await fetch(signedUrl);
        if (pdfRes.ok) {
          const pdfBuf = new Uint8Array(await pdfRes.arrayBuffer());
          const path = `${contrato.user_id}/${contrato.id}/autentique-${doc.id}.pdf`;
          const { error: upErr } = await admin.storage
            .from("contratos-assinados")
            .upload(path, pdfBuf, { upsert: true, contentType: "application/pdf" });
          if (!upErr) {
            patch.arquivo_assinado_path = path;
            patch.arquivo_assinado_nome = `${contrato.titulo || "contrato"}-assinado.pdf`;
            patch.arquivo_assinado_tamanho = pdfBuf.byteLength;
          }
        }
      } catch (e) {
        console.error("[autentique-cron-sync] download pdf falhou", e);
      }
    }
  }

  const { error: upErr } = await admin
    .from("contratos")
    .update(patch)
    .eq("id", contrato.id);
  if (upErr) {
    console.error("[autentique-cron-sync] update falhou", contrato.id, upErr);
    return { changed: false };
  }

  return { changed: true };
}

function jres(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
