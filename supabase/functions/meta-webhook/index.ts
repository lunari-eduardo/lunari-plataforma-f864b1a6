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

  const url = new URL(req.url);

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "" // We need service role to query meta_integrations
    );

    // 1. Webhook Verification (GET)
    if (req.method === "GET") {
      const mode = url.searchParams.get("hub.mode");
      const token = url.searchParams.get("hub.verify_token");
      const challenge = url.searchParams.get("hub.challenge");

      if (mode === "subscribe" && token) {
        // Find if this token exists in any of our user integrations
        const { data: integration, error } = await supabaseClient
          .from("meta_integrations")
          .select("id")
          .eq("webhook_verify_token", token)
          .single();

        if (error || !integration) {
          console.error("Webhook Verification Failed: Invalid Token", token);
          return new Response("Forbidden", { status: 403 });
        }

        console.log("Webhook Verified!");
        return new Response(challenge, { status: 200 });
      }

      return new Response("Forbidden", { status: 403 });
    }

    // 2. Incoming Messages (POST)
    if (req.method === "POST") {
      const body = await req.json();

      // Check if it's a WhatsApp status or message event
      if (body.object === "whatsapp_business_account") {
        for (const entry of body.entry) {
          for (const change of entry.changes) {
            if (change.field === "messages") {
              const value = change.value;
              const metadata = value.metadata;
              
              // Find the user integration by phone_number_id
              const { data: integration, error } = await supabaseClient
                .from("meta_integrations")
                .select("user_id")
                .eq("phone_number_id", metadata.phone_number_id)
                .single();

              if (error || !integration) {
                console.error("Unknown phone number ID", metadata.phone_number_id);
                continue;
              }

              const userId = integration.user_id;

              // Process messages
              if (value.messages) {
                for (const msg of value.messages) {
                  const fromPhone = msg.from; // Customer phone
                  const text = msg.text?.body || "";

                  console.log(`[WhatsApp] User: ${userId} | From: ${fromPhone} | Msg: ${text}`);

                  // 1. Find lead by phone
                  // 2. Insert interaction
                  // 3. (Optional) Trigger AI assistant via background task or pg_net if it needs to draft a reply
                }
              }
            }
          }
        }
        return new Response("EVENT_RECEIVED", { status: 200, headers: corsHeaders });
      } else {
        return new Response("Not a WhatsApp event", { status: 404 });
      }
    }

    return new Response("Method not allowed", { status: 405 });
  } catch (error) {
    console.error("Webhook Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
