import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface InfinitePayWebhookPayload {
  order_nsu: string;
  paid_amount?: number;
  capture_method?: string;
  transaction_nsu?: string;
  items?: Array<{
    quantity: number;
    price: number;
    description: string;
  }>;
  status?: string;
  event?: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Only accept POST
  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 405 }
    );
  }

  try {
    const payload: InfinitePayWebhookPayload = await req.json();
    
    console.log("[infinitepay-webhook] Received webhook:", JSON.stringify(payload));

    const { order_nsu, paid_amount, transaction_nsu, capture_method } = payload;

    if (!order_nsu) {
      console.error("[infinitepay-webhook] Missing order_nsu");
      return new Response(
        JSON.stringify({ error: "order_nsu is required" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Find cobranca by order_nsu (which is the cobranca ID)
    const { data: cobranca, error: findError } = await supabase
      .from("cobrancas")
      .select("*, clientes(nome)")
      .eq("id", order_nsu)
      .eq("provedor", "infinitepay")
      .single();

    if (findError || !cobranca) {
      console.error("[infinitepay-webhook] Cobranca not found:", order_nsu, findError);
      return new Response(
        JSON.stringify({ error: "Cobranca not found" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 404 }
      );
    }

    console.log(`[infinitepay-webhook] Found cobranca: ${cobranca.id}, current status: ${cobranca.status}`);

    // If already paid, just acknowledge
    if (cobranca.status === "pago") {
      console.log("[infinitepay-webhook] Cobranca already paid, acknowledging");
      return new Response(
        JSON.stringify({ success: true, message: "Already processed" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    // Calculate paid amount (InfinitePay sends in centavos)
    const valorPago = paid_amount ? paid_amount / 100 : cobranca.valor;
    const now = new Date().toISOString();

    // Update cobranca to paid
    const { error: updateError } = await supabase
      .from("cobrancas")
      .update({
        status: "pago",
        data_pagamento: now,
        ip_transaction_nsu: transaction_nsu || null,
        updated_at: now,
      })
      .eq("id", cobranca.id);

    if (updateError) {
      console.error("[infinitepay-webhook] Error updating cobranca:", updateError);
      throw new Error("Failed to update cobranca status");
    }

    console.log(`[infinitepay-webhook] Cobranca ${cobranca.id} updated to 'pago'`);

    // If there's a session_id, create transaction and update session
    if (cobranca.session_id) {
      // Create transaction record
      const { error: txError } = await supabase
        .from("clientes_transacoes")
        .insert({
          user_id: cobranca.user_id,
          cliente_id: cobranca.cliente_id,
          session_id: cobranca.session_id,
          valor: valorPago,
          tipo: "pagamento",
          data_transacao: now.split("T")[0],
          descricao: `Pagamento InfinitePay - ${cobranca.descricao || "Link de pagamento"}`,
        });

      if (txError) {
        console.error("[infinitepay-webhook] Error creating transaction:", txError);
        // Don't throw - cobranca is already updated
      } else {
        console.log(`[infinitepay-webhook] Transaction created for session ${cobranca.session_id}`);
      }

      // Update session valor_pago
      const { data: session } = await supabase
        .from("clientes_sessoes")
        .select("valor_pago")
        .eq("session_id", cobranca.session_id)
        .single();

      if (session) {
        const novoValorPago = (session.valor_pago || 0) + valorPago;
        
        await supabase
          .from("clientes_sessoes")
          .update({
            valor_pago: novoValorPago,
            updated_at: now,
          })
          .eq("session_id", cobranca.session_id);

        console.log(`[infinitepay-webhook] Session ${cobranca.session_id} valor_pago updated to ${novoValorPago}`);
      }
    }

    console.log("[infinitepay-webhook] Webhook processed successfully");

    return new Response(
      JSON.stringify({ 
        success: true, 
        cobrancaId: cobranca.id,
        valorPago: valorPago,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );

  } catch (error) {
    console.error("[infinitepay-webhook] Error:", error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
