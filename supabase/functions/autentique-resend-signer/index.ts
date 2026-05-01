// Reenvia o e-mail de assinatura para um signatário específico.
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
    const publicId = String(body?.public_id || "");
    if (!contratoId || !publicId) return jerr("INVALID_INPUT", "contrato_id e public_id são obrigatórios", 400);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: contrato } = await admin
      .from("contratos")
      .select("id, signature_external_id")
      .eq("id", contratoId)
      .eq("user_id", userId)
      .maybeSingle();
    if (!contrato?.signature_external_id) return jerr("NOT_FOUND", "Contrato não enviado", 404);

    const { data: integ } = await admin
      .from("usuarios_integracoes")
      .select("access_token")
      .eq("user_id", userId)
      .eq("provedor", "autentique")
      .eq("status", "conectado")
      .maybeSingle();
    if (!integ?.access_token) return jerr("INTEGRATION_NOT_CONNECTED", "Conecte Autentique", 400);

    const mutation = `
      mutation($public_ids: [UUID!]!) {
        resendSignatures(public_ids: $public_ids)
      }
    `;
    const res = await fetch(AUTENTIQUE_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${integ.access_token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ query: mutation, variables: { public_ids: [publicId] } }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || json?.errors) {
      const msg = json?.errors?.[0]?.message || `Falha Autentique (${res.status})`;
      return jerr("AUTENTIQUE_ERROR", msg, 400);
    }

    return jres({ success: true });
  } catch (e: any) {
    console.error("[autentique-resend-signer] error", e);
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
