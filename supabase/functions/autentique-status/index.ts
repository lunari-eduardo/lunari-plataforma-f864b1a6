// Retorna o status da integração Autentique do usuário.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

const AUTENTIQUE_URL = "https://api.autentique.com.br/v2/graphql";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: { code: "UNAUTHORIZED", message: "Não autenticado" } }, 401);
    }
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: cErr } = await supabase.auth.getClaims(token);
    if (cErr || !claims?.claims) {
      return json({ error: { code: "UNAUTHORIZED", message: "Sessão inválida" } }, 401);
    }
    const userId = claims.claims.sub as string;

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    const { data, error } = await admin
      .from("usuarios_integracoes")
      .select("status, dados_extras, conectado_em, access_token")
      .eq("user_id", userId)
      .eq("provedor", "autentique")
      .maybeSingle();
    if (error) throw error;

    if (!data) {
      return json({ connected: false });
    }

    // Teste opcional (?test=1) — revalida a key na Autentique
    const url = new URL(req.url);
    let valid = true;
    let validationError: string | undefined;
    if (url.searchParams.get("test") === "1" && data.access_token) {
      const r = await fetch(AUTENTIQUE_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${data.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query: `query { me { id } }` }),
      });
      const j = await r.json().catch(() => ({} as any));
      valid = r.ok && !j?.errors && !!j?.data?.me?.id;
      if (!valid) validationError = j?.errors?.[0]?.message || "API Key inválida";
    }

    return json({
      connected: data.status === "conectado",
      account: data.dados_extras || null,
      conectado_em: data.conectado_em,
      valid,
      validationError,
    });
  } catch (e: any) {
    return json({ error: { code: "INTERNAL", message: e?.message } }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
