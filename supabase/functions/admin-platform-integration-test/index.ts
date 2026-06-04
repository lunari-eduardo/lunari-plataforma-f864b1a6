// Admin-only: testa a chave Asaas da plataforma chamando GET /v3/customers?limit=1.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: userErr } = await supabase.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: isAdmin } = await admin.rpc("has_role", { _user_id: user.id, _role: "admin" });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden: admin only" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const provider = String(body.provider || "asaas");
    const scope = String(body.scope || "subscriptions");

    const { data: integ, error: readErr } = await admin
      .from("platform_integrations")
      .select("environment, api_key")
      .eq("provider", provider)
      .eq("scope", scope)
      .maybeSingle();

    if (readErr || !integ) {
      return new Response(JSON.stringify({ ok: false, error: "Integração não encontrada" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const baseUrl = integ.environment === "production"
      ? "https://api.asaas.com"
      : "https://api-sandbox.asaas.com";

    let status = "ok";
    let message = "Conexão OK";
    try {
      const res = await fetch(`${baseUrl}/v3/customers?limit=1`, {
        headers: { access_token: integ.api_key },
      });
      if (!res.ok) {
        status = "error";
        const txt = await res.text();
        message = `HTTP ${res.status}: ${txt.slice(0, 200)}`;
      } else {
        const json = await res.json();
        message = `OK — ${json.totalCount ?? 0} customer(s) acessível(eis)`;
      }
    } catch (e) {
      status = "error";
      message = (e as Error).message;
    }

    await admin
      .from("platform_integrations")
      .update({
        last_test_at: new Date().toISOString(),
        last_test_status: status,
        last_test_message: message,
      })
      .eq("provider", provider)
      .eq("scope", scope);

    return new Response(JSON.stringify({ ok: status === "ok", status, message, environment: integ.environment }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
