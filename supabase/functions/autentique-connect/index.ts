// Conecta a conta Autentique do usuário validando a API Key.
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
      return json({ error: { code: "UNAUTHORIZED", message: "Não autenticado" } }, 401);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: claimsErr } = await supabase.auth.getClaims(token);
    if (claimsErr || !claims?.claims) {
      return json({ error: { code: "UNAUTHORIZED", message: "Sessão inválida" } }, 401);
    }
    const userId = claims.claims.sub as string;

    const body = await req.json().catch(() => ({}));
    const apiKey = String(body?.api_key || "").trim();
    if (apiKey.length < 20) {
      return json({ error: { code: "INVALID_API_KEY", message: "API Key inválida." } }, 400);
    }

    // Valida na Autentique consultando o "me"
    const meRes = await fetch(AUTENTIQUE_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: `query { me { id name email } }`,
      }),
    });
    const meJson = await meRes.json().catch(() => ({} as any));
    if (!meRes.ok || meJson?.errors || !meJson?.data?.me?.id) {
      const msg = meJson?.errors?.[0]?.message || "Não foi possível validar a API Key.";
      return json({ error: { code: "INVALID_API_KEY", message: msg } }, 400);
    }
    const me = meJson.data.me as { id: string; name: string; email: string };

    // Service role para gravar em usuarios_integracoes
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Upsert por (user_id, provedor)
    const { data: existing } = await admin
      .from("usuarios_integracoes")
      .select("id")
      .eq("user_id", userId)
      .eq("provedor", "autentique")
      .maybeSingle();

    const payload = {
      user_id: userId,
      provedor: "autentique",
      access_token: apiKey,
      status: "conectado",
      conectado_em: new Date().toISOString(),
      dados_extras: {
        account_id: me.id,
        name: me.name,
        email: me.email,
      },
    };

    if (existing?.id) {
      const { error } = await admin
        .from("usuarios_integracoes")
        .update(payload)
        .eq("id", existing.id);
      if (error) throw error;
    } else {
      const { error } = await admin.from("usuarios_integracoes").insert(payload);
      if (error) throw error;
    }

    return json({
      success: true,
      account: { name: me.name, email: me.email, id: me.id },
    });
  } catch (e: any) {
    console.error("[autentique-connect] error", e);
    return json(
      { error: { code: "INTERNAL", message: e?.message || "Erro interno" } },
      500
    );
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
