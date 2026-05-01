// Sincroniza o status de um contrato com a Autentique sob demanda.
// Atualiza signers, status e baixa o PDF assinado quando concluído.
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
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return jerr("UNAUTHORIZED", "Não autenticado", 401);

    const supa = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: cErr } = await supa.auth.getClaims(token);
    if (cErr || !claims?.claims) return jerr("UNAUTHORIZED", "Sessão inválida", 401);
    const userId = claims.claims.sub as string;

    const body = await req.json().catch(() => ({} as any));
    const contratoId = String(body?.contrato_id || "");
    if (!contratoId) return jerr("INVALID_INPUT", "contrato_id é obrigatório", 400);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: contrato, error: contratoErr } = await admin
      .from("contratos")
      .select("id, user_id, titulo, signature_external_id, status")
      .eq("id", contratoId)
      .eq("user_id", userId)
      .maybeSingle();
    if (contratoErr || !contrato) return jerr("NOT_FOUND", "Contrato não encontrado", 404);
    if (!contrato.signature_external_id) {
      return jerr("NOT_SENT", "Contrato ainda não foi enviado para assinatura", 400);
    }

    const { data: integ } = await admin
      .from("usuarios_integracoes")
      .select("access_token")
      .eq("user_id", userId)
      .eq("provedor", "autentique")
      .eq("status", "conectado")
      .maybeSingle();
    if (!integ?.access_token) {
      return jerr("INTEGRATION_NOT_CONNECTED", "Conecte sua conta Autentique", 400);
    }

    const result = await syncDocument({
      admin,
      apiKey: integ.access_token,
      contrato,
    });

    return jres(result);
  } catch (e: any) {
    console.error("[autentique-sync-contrato] error", e);
    return jerr("INTERNAL", e?.message || "Erro interno", 500);
  }
});

export async function syncDocument({
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
        id
        name
        signed_count
        files { signed original }
        signatures {
          public_id
          name
          email
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
    const msg = json?.errors?.[0]?.message || `Falha Autentique (${res.status})`;
    throw new Error(msg);
  }

  const doc = json.data.document;
  const sigs: any[] = doc.signatures || [];

  const signersOut = sigs.map((s) => {
    let status: "assinado" | "recusado" | "visualizado" | "pendente" = "pendente";
    let timestamp: string | null = null;
    if (s.signed?.created_at) {
      status = "assinado";
      timestamp = s.signed.created_at;
    } else if (s.rejected?.created_at) {
      status = "recusado";
      timestamp = s.rejected.created_at;
    } else if (s.viewed?.created_at) {
      status = "visualizado";
      timestamp = s.viewed.created_at;
    }
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
  let downloaded = false;

  if (anyRejected) {
    patch.status = "cancelado";
  } else if (allSigned) {
    patch.status = "assinado";
    const lastSigned = signersOut
      .map((s) => s.timestamp)
      .filter(Boolean)
      .sort()
      .pop();
    patch.assinado_em = lastSigned || new Date().toISOString();

    // Baixa o PDF assinado
    const signedUrl = doc.files?.signed;
    if (signedUrl) {
      try {
        const pdfRes = await fetch(signedUrl);
        if (pdfRes.ok) {
          const pdfBuf = new Uint8Array(await pdfRes.arrayBuffer());
          const path = `${contrato.user_id}/${contrato.id}/autentique-${doc.id}.pdf`;
          const { error: upErr } = await admin.storage
            .from("contratos-assinados")
            .upload(path, pdfBuf, {
              upsert: true,
              contentType: "application/pdf",
            });
          if (!upErr) {
            patch.arquivo_assinado_path = path;
            patch.arquivo_assinado_nome = `${contrato.titulo || "contrato"}-assinado.pdf`;
            patch.arquivo_assinado_tamanho = pdfBuf.byteLength;
            downloaded = true;
          } else {
            console.error("[autentique-sync] upload error", upErr);
          }
        }
      } catch (e) {
        console.error("[autentique-sync] download pdf failed", e);
      }
    }
  }

  const { error: upErr } = await admin
    .from("contratos")
    .update(patch)
    .eq("id", contrato.id);
  if (upErr) throw upErr;

  return {
    success: true,
    document_id: doc.id,
    status: patch.status || contrato.status,
    signers: signersOut,
    pdf_downloaded: downloaded,
  };
}

function jres(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
function jerr(code: string, message: string, status = 400) {
  return jres({ error: { code, message } }, status);
}
