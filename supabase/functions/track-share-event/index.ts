import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.44.4";

// CORS headers
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "", // Usa service_role pois eventos são anônimos
    );

    const { share_id, event_type, metadata } = await req.json();

    if (!share_id || !event_type) {
      return new Response(JSON.stringify({ error: "Parâmetros faltando" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Pega IP (a forma exata depende do ambiente, X-Forwarded-For no Supabase)
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "0.0.0.0";
    const userAgent = req.headers.get("user-agent") || "unknown";

    // Hash do IP com um salt (pode ser configurado como Env var)
    const salt = Deno.env.get("ANALYTICS_SALT") || "lunari-salt";
    
    const data = new TextEncoder().encode(ip + salt);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const ipHash = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

    // 1. Acha ou cria a Sessão
    // Vamos verificar se há uma sessão recente para este share_id e ip_hash
    // Uma sessão é considerada "ativa" se created_at for recente (< 30 min)
    const thirtyMinsAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();

    let { data: session } = await supabaseClient
      .from("material_share_sessions")
      .select("id")
      .eq("share_id", share_id)
      .eq("ip_hash", ipHash)
      .gte("created_at", thirtyMinsAgo)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!session) {
      // Cria nova sessão
      const { data: newSession, error: createError } = await supabaseClient
        .from("material_share_sessions")
        .insert({
          share_id,
          ip_hash: ipHash,
          user_agent: userAgent,
        })
        .select("id")
        .single();

      if (createError) {
        throw createError;
      }
      session = newSession;
    }

    // 2. Insere o evento
    const { error: insertError } = await supabaseClient
      .from("material_share_events")
      .insert({
        share_id,
        session_id: session.id,
        event_type,
        metadata: metadata || {},
      });

    if (insertError) {
      throw insertError;
    }

    return new Response(JSON.stringify({ success: true, session_id: session.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: any) {
    console.error("Erro na Edge Function track-share-event:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
