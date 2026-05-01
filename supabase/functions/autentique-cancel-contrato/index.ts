// Cancela um contrato enviado à Autentique (deleteDocument).
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

    const { data: contrato } = await admin
      .from("contratos")
      .select("id, signature_external_id, observacoes")
      .eq("id", contratoId)
      .eq("user_id", userId)
      .maybeSingle();
    if (!contrato) return jerr("NOT_FOUND", "Contrato não encontrado", 404);
    if (!contrato.signature_external_id) return jerr("NOT_SENT", "Não enviado", 400);

    const { data: integ } = await admin
      .from("usuarios_integracoes")
      .select("access_token")
      .eq("user_id", userId)
      .eq("provedor", "autentique")
      .eq("status", "conectado")
      .maybeSingle();
    if (!integ?.access_token) return jerr("INTEGRATION_NOT_CONNECTED", "Conecte Autentique", 400);

    const mutation = `mutation($id: UUID!) { deleteDocument(id: $id) }`;
    const res = await fetch(AUTENTIQUE_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${integ.access_token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ query: mutation, variables: { id: contrato.signature_external_id } }),
    });
    const json = await res.json().catch(() => ({}));
    // Mesmo se a Autentique retornar erro de "já deletado", seguimos o cancelamento local.
    if (!res.ok && !json?.data) {
      console.warn("[autentique-cancel] aviso:", json);
    }

    const histNote = `[Autentique cancelado em ${new Date().toISOString()}] doc_id=${contrato.signature_external_id}`;
    const novasObs = contrato.observacoes
      ? `${contrato.observacoes}\n${histNote}`
      : histNote;

    const { error: upErr } = await admin
      .from("contratos")
      .update({
        status: "cancelado",
        signature_external_id: null,
        signers: null,
        observacoes: novasObs,
      })
      .eq("id", contrato.id);
    if (upErr) throw upErr;

    return jres({ success: true });
  } catch (e: any) {
    console.error("[autentique-cancel-contrato] error", e);
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
