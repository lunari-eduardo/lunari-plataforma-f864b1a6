// Webhook público da Autentique. Sem JWT.
// Reaproveita lógica de sync para atualizar o contrato e baixar o PDF assinado.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const AUTENTIQUE_URL = "https://api.autentique.com.br/v2/graphql";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const payload = await req.json().catch(() => ({} as any));
    console.log("[autentique-webhook] payload", JSON.stringify(payload).slice(0, 500));

    // A Autentique envia diferentes formatos. Tentamos extrair o documento.
    const docId =
      payload?.document?.id ||
      payload?.data?.document?.id ||
      payload?.document_id ||
      payload?.uuid ||
      null;

    if (!docId) {
      console.warn("[autentique-webhook] sem document id no payload");
      return jres({ ignored: true, reason: "no_document_id" });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: contrato } = await admin
      .from("contratos")
      .select("id, user_id, titulo, signature_external_id, status")
      .eq("signature_external_id", docId)
      .maybeSingle();
    if (!contrato) {
      console.warn("[autentique-webhook] contrato não encontrado para doc_id", docId);
      return jres({ ignored: true, reason: "contract_not_found" });
    }

    const { data: integ } = await admin
      .from("usuarios_integracoes")
      .select("access_token")
      .eq("user_id", contrato.user_id)
      .eq("provedor", "autentique")
      .eq("status", "conectado")
      .maybeSingle();
    if (!integ?.access_token) {
      console.warn("[autentique-webhook] integração ausente para user", contrato.user_id);
      return jres({ ignored: true, reason: "integration_missing" });
    }

    const result = await syncDocument({ admin, apiKey: integ.access_token, contrato });
    return jres({ success: true, ...result });
  } catch (e: any) {
    console.error("[autentique-webhook] error", e);
    // Sempre 200 para não disparar reentregas em loop por erro nosso
    return jres({ success: false, error: e?.message || "internal" });
  }
});

async function syncDocument({
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
        id name files { signed original }
        signatures {
          public_id name email
          signed { created_at } rejected { created_at } viewed { created_at }
          link { short_link } action { name }
        }
      }
    }
  `;
  const res = await fetch(AUTENTIQUE_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables: { id: contrato.signature_external_id } }),
  });
  const json = await res.json().catch(() => ({} as any));
  if (!res.ok || !json?.data?.document) {
    throw new Error(json?.errors?.[0]?.message || `Falha Autentique ${res.status}`);
  }
  const doc = json.data.document;
  const sigs: any[] = doc.signatures || [];

  const signersOut = sigs.map((s) => {
    let status: string = "pendente";
    let timestamp: string | null = null;
    if (s.signed?.created_at) { status = "assinado"; timestamp = s.signed.created_at; }
    else if (s.rejected?.created_at) { status = "recusado"; timestamp = s.rejected.created_at; }
    else if (s.viewed?.created_at) { status = "visualizado"; timestamp = s.viewed.created_at; }
    return {
      public_id: s.public_id, email: s.email, nome: s.name,
      papel: s.action?.name, link: s.link?.short_link, status, timestamp,
    };
  });

  const allSigned = signersOut.length > 0 && signersOut.every((s) => s.status === "assinado");
  const anyRejected = signersOut.some((s) => s.status === "recusado");

  const patch: any = { signers: signersOut };
  if (anyRejected) patch.status = "cancelado";
  else if (allSigned) {
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
        console.error("[autentique-webhook] download falhou", e);
      }
    }
  }

  const { error } = await admin.from("contratos").update(patch).eq("id", contrato.id);
  if (error) throw error;
  return { document_id: doc.id, status: patch.status || contrato.status };
}

function jres(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
