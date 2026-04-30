// Envia um contrato para assinatura via Autentique.
// Recebe { contrato_id, pdf_base64 } e cria documento + signatário(s).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const AUTENTIQUE_URL = "https://api.autentique.com.br/v2/graphql";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jerr("UNAUTHORIZED", "Não autenticado", 401);
    }
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
    const pdfBase64 = String(body?.pdf_base64 || "");
    const includeFotografoAsSigner = !!body?.include_fotografo;
    if (!contratoId) return jerr("INVALID_INPUT", "contrato_id é obrigatório", 400);
    if (!pdfBase64 || pdfBase64.length < 1000) {
      return jerr("INVALID_INPUT", "PDF inválido ou vazio", 400);
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 1) Resolve contrato + cliente
    const { data: contrato, error: contratoErr } = await admin
      .from("contratos")
      .select(
        `id, user_id, titulo, conteudo, status, signature_external_id,
         cliente:clientes(id, nome, email)`
      )
      .eq("id", contratoId)
      .eq("user_id", userId)
      .maybeSingle();
    if (contratoErr || !contrato) return jerr("NOT_FOUND", "Contrato não encontrado", 404);
    if (!contrato.conteudo || contrato.conteudo.trim().length < 10) {
      return jerr("EMPTY_CONTRACT", "Contrato sem conteúdo", 400);
    }
    const clienteEmail = (contrato as any).cliente?.email?.trim();
    const clienteNome = (contrato as any).cliente?.nome?.trim();
    if (!clienteEmail) {
      return jerr("CLIENT_EMAIL_MISSING", "Cliente não possui e-mail cadastrado", 400);
    }

    // 2) Resolve API Key Autentique
    const { data: integ } = await admin
      .from("usuarios_integracoes")
      .select("access_token, dados_extras")
      .eq("user_id", userId)
      .eq("provedor", "autentique")
      .eq("status", "conectado")
      .maybeSingle();
    if (!integ?.access_token) {
      return jerr("INTEGRATION_NOT_CONNECTED", "Conecte sua conta Autentique em Configurações > Integrações", 400);
    }

    // 3) Perfil do fotógrafo (opcional como signatário)
    let fotografoEmail: string | undefined;
    let fotografoNome: string | undefined;
    if (includeFotografoAsSigner) {
      const { data: prof } = await admin
        .from("profiles")
        .select("nome, email")
        .eq("user_id", userId)
        .maybeSingle();
      fotografoEmail = prof?.email || (claims.claims.email as string | undefined);
      fotografoNome = prof?.nome || undefined;
    }

    // 4) Monta signatários
    const signers: Array<{ email: string; name?: string; action: string }> = [
      { email: clienteEmail, name: clienteNome, action: "SIGN" },
    ];
    if (includeFotografoAsSigner && fotografoEmail) {
      signers.push({ email: fotografoEmail, name: fotografoNome, action: "SIGN" });
    }

    // 5) Cria documento na Autentique via GraphQL multipart
    const pdfBytes = base64ToBytes(pdfBase64);
    const filename = sanitizeFilename(`${contrato.titulo || "contrato"}.pdf`);

    const operations = {
      query: `
        mutation CreateDocumentMutation(
          $document: DocumentInput!,
          $signers: [SignerInput!]!,
          $file: Upload!
        ) {
          createDocument(document: $document, signers: $signers, file: $file) {
            id
            name
            created_at
            signatures {
              public_id
              name
              email
              action { name }
              link { short_link }
            }
          }
        }
      `,
      variables: {
        document: { name: contrato.titulo || "Contrato" },
        signers: signers.map((s) => ({
          email: s.email,
          action: s.action,
          ...(s.name ? { name: s.name } : {}),
        })),
        file: null,
      },
    };
    const map = { "0": ["variables.file"] };

    const form = new FormData();
    form.append("operations", JSON.stringify(operations));
    form.append("map", JSON.stringify(map));
    form.append("0", new Blob([pdfBytes], { type: "application/pdf" }), filename);

    const auteRes = await fetch(AUTENTIQUE_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${integ.access_token}` },
      body: form,
    });
    const auteJson = await auteRes.json().catch(() => ({} as any));

    if (!auteRes.ok || auteJson?.errors || !auteJson?.data?.createDocument?.id) {
      const msg = auteJson?.errors?.[0]?.message || `Falha na Autentique (${auteRes.status})`;
      const code = inferErrorCode(msg, auteRes.status);
      console.error("[autentique-send-contrato] Autentique error", { status: auteRes.status, body: auteJson });
      return jerr(code, msg, 400);
    }

    const doc = auteJson.data.createDocument;
    const signersOut = (doc.signatures || []).map((s: any) => ({
      public_id: s.public_id,
      email: s.email,
      nome: s.name,
      papel: s.action?.name,
      link: s.link?.short_link,
      status: "pendente",
    }));

    // 6) Atualiza contrato
    const { error: upErr } = await admin
      .from("contratos")
      .update({
        signature_provider: "autentique",
        signature_external_id: doc.id,
        signers: signersOut,
        status: "enviado",
        enviado_em: new Date().toISOString(),
      })
      .eq("id", contrato.id);
    if (upErr) throw upErr;

    return jres({
      success: true,
      document_id: doc.id,
      signers: signersOut,
    });
  } catch (e: any) {
    console.error("[autentique-send-contrato] error", e);
    return jerr("INTERNAL", e?.message || "Erro interno", 500);
  }
});

function jres(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
function jerr(code: string, message: string, status = 400) {
  return jres({ error: { code, message } }, status);
}
function base64ToBytes(b64: string): Uint8Array {
  const clean = b64.replace(/^data:.*;base64,/, "");
  const bin = atob(clean);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
function sanitizeFilename(name: string): string {
  return name.replace(/[^\w\-. ]+/g, "_").slice(0, 120);
}
function inferErrorCode(msg: string, status: number): string {
  const m = (msg || "").toLowerCase();
  if (m.includes("unauth") || status === 401) return "INVALID_API_KEY";
  if (m.includes("limit") || m.includes("plan")) return "AUTENTIQUE_PLAN_LIMIT";
  if (m.includes("rate")) return "AUTENTIQUE_RATE_LIMIT";
  if (m.includes("email")) return "INVALID_SIGNER_EMAIL";
  return "AUTENTIQUE_ERROR";
}
