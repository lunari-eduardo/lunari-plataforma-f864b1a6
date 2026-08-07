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

      if (mode === "subscribe" && token === "lunari_whatsapp_secret_2026") {
        console.log("Webhook Verified via GET!");
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
              
              if (value.messages) {
                for (const msg of value.messages) {
                  const fromPhone = msg.from; // Customer phone (e.g. 5511999999999)
                  const text = msg.text?.body || "";

                  console.log(`[WhatsApp] Recebido de ${fromPhone}: ${text}`);

                  if (!text) continue;

                  // 1. Encontrar o Lead pelo telefone
                  // Usamos um ilike para permitir variações de DDI/DDD
                  const { data: leads, error: findError } = await supabaseClient
                    .from("leads")
                    .select("id, interacoes")
                    .or(`telefone.ilike.%${fromPhone.substring(2)}%,whatsapp.ilike.%${fromPhone.substring(2)}%`)
                    .limit(1);

                  if (findError || !leads || leads.length === 0) {
                    console.log(`Nenhum lead encontrado para o número: ${fromPhone}`);
                    continue;
                  }

                  const lead = leads[0];
                  
                  // 2. Criar a interação
                  const novaInteracao = {
                    id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
                    data: new Date().toISOString(),
                    tipo: "whatsapp",
                    descricao: `Mensagem recebida: "${text}"`,
                    automatica: true
                  };

                  const interacoes = Array.isArray(lead.interacoes) ? lead.interacoes : [];
                  
                  // 3. Atualizar o Lead no banco
                  const { error: updateError } = await supabaseClient
                    .from("leads")
                    .update({ 
                      interacoes: [novaInteracao, ...interacoes],
                      status_timestamp: new Date().toISOString()
                    })
                    .eq("id", lead.id);

                  if (updateError) {
                    console.error("Erro ao atualizar interações do lead:", updateError);
                  } else {
                    console.log("Interação salva com sucesso no lead:", lead.id);
                  }
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
