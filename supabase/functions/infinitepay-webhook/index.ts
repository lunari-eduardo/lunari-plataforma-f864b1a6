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
  capture_method?: string; // "pix" | "credit"
  transaction_nsu?: string;
  receipt_url?: string;
  installments?: number;
  slug?: string;
  items?: Array<{
    quantity: number;
    price: number;
    description: string;
  }>;
  status?: string;
  event?: string;
}

// CONTRATO OFICIAL: Nenhum regex ou inferência de formato de order_nsu

serve(async (req) => {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

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

  // PASSO 1: Ler corpo como texto bruto ANTES de qualquer processamento
  let rawBody = "";
  try {
    rawBody = await req.text();
  } catch (readError) {
    rawBody = "FAILED_TO_READ_BODY";
    console.error("[infinitepay-webhook] Failed to read request body:", readError);
  }

  // PASSO 2: SEMPRE logar ANTES de tentar parse (contrato: nunca falhar antes de logar)
  try {
    await supabase.from("webhook_logs").insert({
      provedor: "infinitepay",
      order_nsu: "pending_parse",
      payload: { raw: rawBody.substring(0, 10000) }, // Limitar tamanho
      headers: Object.fromEntries(req.headers.entries()),
      status: "received",
    });
  } catch (logError) {
    console.warn("[infinitepay-webhook] Failed to log webhook:", logError);
  }

  // PASSO 3: Agora tentar parse do JSON
  let payload: InfinitePayWebhookPayload;
  try {
    payload = JSON.parse(rawBody);
  } catch (parseError) {
    console.error("[infinitepay-webhook] Invalid JSON:", parseError);
    
    // Atualizar log com erro
    try {
      await supabase
        .from("webhook_logs")
        .update({ status: "error", error_message: "Invalid JSON" })
        .eq("order_nsu", "pending_parse")
        .eq("provedor", "infinitepay");
    } catch {
      // Ignorar erro de update
    }
    
    return new Response(
      JSON.stringify({ error: "Invalid JSON" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
    );
  }

  const { order_nsu, paid_amount, transaction_nsu, capture_method, receipt_url } = payload;
  
  console.log("[infinitepay-webhook] Received webhook:", JSON.stringify(payload));

  // PASSO 4: Atualizar log com order_nsu real
  if (order_nsu) {
    try {
      await supabase
        .from("webhook_logs")
        .update({ order_nsu: order_nsu, payload: payload })
        .eq("order_nsu", "pending_parse")
        .eq("provedor", "infinitepay");
    } catch {
      // Ignorar erro de update
    }
  }

  if (!order_nsu) {
    console.error("[infinitepay-webhook] Missing order_nsu");
    return new Response(
      JSON.stringify({ error: "order_nsu is required" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
    );
  }

  try {
    // ESTRATÉGIA DE BUSCA CONFORME CONTRATO OFICIAL
    // 1º: SEMPRE buscar por ip_order_nsu primeiro
    // 2º: Fallback por id (sem regex!)
    let cobranca = null;
    let searchMethod = "";

    // 1º: Buscar por ip_order_nsu = order_nsu
    console.log(`[infinitepay-webhook] 1st search: ip_order_nsu = ${order_nsu}`);
    const { data: byNsu, error: nsuError } = await supabase
      .from("cobrancas")
      .select("*, clientes(nome)")
      .eq("ip_order_nsu", order_nsu)
      .eq("provedor", "infinitepay")
      .maybeSingle();

    if (nsuError) {
      console.error("[infinitepay-webhook] Error searching by ip_order_nsu:", nsuError);
    }

    if (byNsu) {
      cobranca = byNsu;
      searchMethod = "by_ip_order_nsu";
      console.log(`[infinitepay-webhook] Found by ip_order_nsu: ${byNsu.id}`);
    }

    // 2º: Fallback por id (sem regex - query simplesmente não retorna se não for UUID válido)
    if (!cobranca) {
      console.log(`[infinitepay-webhook] 2nd search (fallback): id = ${order_nsu}`);
      const { data: byId, error: idError } = await supabase
        .from("cobrancas")
        .select("*, clientes(nome)")
        .eq("id", order_nsu)
        .eq("provedor", "infinitepay")
        .maybeSingle();

      if (idError) {
        console.error("[infinitepay-webhook] Error searching by id:", idError);
      }

      if (byId) {
        cobranca = byId;
        searchMethod = "by_id";
        console.log(`[infinitepay-webhook] Found by id: ${byId.id}`);
      }
    }

    // 3. Se ainda não encontrou, retornar 404
    if (!cobranca) {
      console.error("[infinitepay-webhook] Cobranca not found:", order_nsu);
      
      // Update webhook log with error
      await supabase
        .from("webhook_logs")
        .update({ status: "error", error_message: "Cobranca not found" })
        .eq("order_nsu", order_nsu)
        .eq("provedor", "infinitepay");

      return new Response(
        JSON.stringify({ error: "Cobranca not found", order_nsu, searchMethods: ["by_ip_order_nsu", "by_id"] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 404 }
      );
    }

    console.log(`[infinitepay-webhook] Found cobranca via ${searchMethod}: ${cobranca.id}, current status: ${cobranca.status}`);

    // If already paid, verify transaction exists (race condition protection)
    if (cobranca.status === "pago") {
      console.log("[infinitepay-webhook] Cobranca already paid, checking if transaction exists...");
      
      // Check if transaction was created for this cobranca
      if (cobranca.session_id) {
        // Find the session (text session_id or UUID)
        let session = null;
        const { data: byText } = await supabase
          .from("clientes_sessoes")
          .select("session_id, cliente_id, id")
          .eq("session_id", cobranca.session_id)
          .maybeSingle();
        
        if (byText) {
          session = byText;
        } else {
          const { data: byUuid } = await supabase
            .from("clientes_sessoes")
            .select("session_id, cliente_id, id")
            .eq("id", cobranca.session_id)
            .maybeSingle();
          if (byUuid) session = byUuid;
        }

        if (session) {
          const textSessionId = session.session_id;
          
          // Check if InfinitePay transaction already exists for this session+value
          const { data: existingTx } = await supabase
            .from("clientes_transacoes")
            .select("id")
            .eq("session_id", textSessionId)
            .ilike("descricao", "%InfinitePay%")
            .eq("valor", cobranca.valor)
            .maybeSingle();

          if (!existingTx) {
            console.log(`[infinitepay-webhook] Transaction MISSING for already-paid cobranca. Creating retroactively...`);
            
            const clienteId = session.cliente_id || cobranca.cliente_id;
            const captureLabel = capture_method === 'pix' ? 'Pix' : capture_method === 'credit' ? 'Cartão' : 'Link';
            const descricao = `Pagamento InfinitePay (${captureLabel})${cobranca.descricao ? ` - ${cobranca.descricao}` : ''}`;
            const now = new Date().toISOString();

            const { error: txError } = await supabase
              .from("clientes_transacoes")
              .insert({
                user_id: cobranca.user_id,
                cliente_id: clienteId,
                session_id: textSessionId,
                valor: cobranca.valor,
                tipo: "pagamento",
                data_transacao: now.split("T")[0],
                descricao: descricao,
              });

            if (txError) {
              console.error("[infinitepay-webhook] Error creating retroactive transaction:", txError);
            } else {
              console.log(`[infinitepay-webhook] Retroactive transaction created for session ${textSessionId}, valor ${cobranca.valor}`);
            }
          } else {
            console.log("[infinitepay-webhook] Transaction already exists, no action needed");
          }
        } else {
          console.warn(`[infinitepay-webhook] Session not found for already-paid cobranca: ${cobranca.session_id}`);
        }
      }

      await supabase
        .from("webhook_logs")
        .update({ status: "already_paid_verified", error_message: "Already paid - transaction verified" })
        .eq("order_nsu", order_nsu)
        .eq("provedor", "infinitepay");

      return new Response(
        JSON.stringify({ success: true, message: "Already processed - transaction verified" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    // Calculate paid amount (InfinitePay sends in centavos)
    const valorPago = paid_amount ? paid_amount / 100 : cobranca.valor;
    const now = new Date().toISOString();

    // Update cobranca to paid with all fields
    const { error: updateError } = await supabase
      .from("cobrancas")
      .update({
        status: "pago",
        data_pagamento: now,
        ip_transaction_nsu: transaction_nsu || null,
        ip_receipt_url: receipt_url || null,
        updated_at: now,
      })
      .eq("id", cobranca.id);

    if (updateError) {
      console.error("[infinitepay-webhook] Error updating cobranca:", updateError);
      throw new Error("Failed to update cobranca status");
    }

    console.log(`[infinitepay-webhook] Cobranca ${cobranca.id} updated to 'pago'`);

    // NOTE: Transaction creation is handled by the database trigger
    // `ensure_transaction_on_cobranca_paid` which fires when cobrancas.status
    // changes to 'pago'. This prevents duplicate transactions.
    // The trigger also handles session recompute via `recompute_session_paid`.
    if (cobranca.session_id) {
      console.log(`[infinitepay-webhook] Session ${cobranca.session_id} will be updated by DB trigger (ensure_transaction_on_cobranca_paid + recompute_session_paid)`);
    }

    // Update webhook log as processed
    await supabase
      .from("webhook_logs")
      .update({ status: "processed" })
      .eq("order_nsu", order_nsu)
      .eq("provedor", "infinitepay");

    console.log("[infinitepay-webhook] Webhook processed successfully");

    return new Response(
      JSON.stringify({ 
        success: true, 
        cobrancaId: cobranca.id,
        valorPago: valorPago,
        searchMethod: searchMethod,
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
