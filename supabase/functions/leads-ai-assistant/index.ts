import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // CORS Preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const body = await req.json().catch(() => ({}));
    const action = body.action || "cron_followup";

    if (action === "cron_followup") {
      // 1. Fetch all active follow-up configs
      // 2. Fetch leads matching the criteria
      // 3. Draft AI follow-up messages
      // 4. Update leads with interaction and AI suggestion
      
      console.log("[AI Assistant] Running cron follow-up check...");
      return new Response(JSON.stringify({ success: true, message: "Cron executed" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "draft_reply") {
      // Called by meta-webhook when a lead sends a message
      const { leadId, message } = body;
      
      // 1. Fetch lead interaction history
      // 2. Query LLM (OpenAI / Anthropic) with context
      // 3. Save draft reply as a pending interaction
      
      console.log(`[AI Assistant] Drafting reply for lead: ${leadId}`);
      return new Response(JSON.stringify({ success: true, message: "Draft created" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response("Invalid action", { status: 400 });
  } catch (error) {
    console.error("AI Assistant Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
