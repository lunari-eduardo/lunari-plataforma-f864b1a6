// ⚠️ PLATAFORMA LUNARI — usa exclusivamente a chave Asaas do sistema (assinaturas Lunari).
// NUNCA usar para cobranças de fotógrafos. Chave via `_shared/platform-asaas.ts`.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getPlatformAsaasConfig } from "../_shared/platform-asaas.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = user.id;
    const { subscriptionId, action } = await req.json();

    if (!subscriptionId) {
      return new Response(
        JSON.stringify({ error: "subscriptionId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const platformCfg = await getPlatformAsaasConfig(adminClient);
    if (!platformCfg) {
      return new Response(
        JSON.stringify({ error: "Integração Asaas (plataforma) não configurada" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const ASAAS_API_KEY = platformCfg.apiKey;
    const ASAAS_BASE_URL = platformCfg.baseUrl;

    const { data: sub } = await adminClient
      .from("subscriptions_asaas")
      .select("asaas_subscription_id, status")
      .eq("id", subscriptionId)
      .eq("user_id", userId)
      .single();

    if (!sub) {
      return new Response(
        JSON.stringify({ error: "Subscription not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Reactivate flow
    if (action === "reactivate") {
      if (sub.status !== "CANCELLED") {
        return new Response(
          JSON.stringify({ error: "Subscription is not cancelled" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      await adminClient
        .from("subscriptions_asaas")
        .update({ status: "ACTIVE" })
        .eq("id", subscriptionId);

      return new Response(
        JSON.stringify({ success: true, action: "reactivated" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Cancel flow
    if (sub.asaas_subscription_id) {
      await fetch(
        `${ASAAS_BASE_URL}/v3/subscriptions/${sub.asaas_subscription_id}`,
        { method: "DELETE", headers: { access_token: ASAAS_API_KEY } }
      );
    }

    await adminClient
      .from("subscriptions_asaas")
      .update({ status: "CANCELLED" })
      .eq("id", subscriptionId);

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});