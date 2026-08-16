// supabase/functions/infinitepay-webhook/index.ts
// Webhook da InfinitePay com reconciliação determinística O(1) e máquina de estados

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.2";
import { corsHeaders, jsonResponse } from "../_shared/auth-guard.ts";
import { normalizeGatewayStatus, canTransition } from "../_shared/state-machine.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface InfinitePayWebhookPayload {
  order_nsu: string;
  paid_amount?: number;
  capture_method?: string;
  transaction_nsu?: string;
  receipt_url?: string;
  installments?: number;
  slug?: string;
  status?: string;
  event?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // 1. Ler corpo bruto e logar preliminarmente
  let rawBody = "";
  try {
    rawBody = await req.text();
  } catch (readError) {
    console.error("[infinitepay-webhook] Erro ao ler corpo da requisição:", readError);
    return jsonResponse({ error: "Failed to read body" }, 400);
  }

  let payload: InfinitePayWebhookPayload;
  try {
    payload = JSON.parse(rawBody);
  } catch (parseError) {
    console.error("[infinitepay-webhook] JSON inválido:", parseError);
    return jsonResponse({ error: "Invalid JSON" }, 400);
  }

  const { order_nsu, paid_amount, transaction_nsu, receipt_url } = payload;
  console.log("[infinitepay-webhook] Recebido payload:", JSON.stringify(payload));

  // Log no banco
  await supabase.from("webhook_logs").insert({
    provedor: "infinitepay",
    order_nsu: order_nsu || "unknown",
    payload,
    headers: Object.fromEntries(req.headers.entries()),
    status: "received",
  }).then(() => {}, (err) => console.warn("[infinitepay-webhook] Falha no log:", err));

  if (!order_nsu) {
    console.error("[infinitepay-webhook] order_nsu ausente");
    return jsonResponse({ error: "order_nsu is required" }, 400);
  }

  try {
    // 2. BUSCA O(1) DA COBRANÇA
    let { data: cobranca } = await supabase
      .from("cobrancas")
      .select("*")
      .or(`ip_order_nsu.eq.${order_nsu},id.eq.${order_nsu},provider_order_id.eq.${order_nsu}`)
      .maybeSingle();

    if (!cobranca) {
      console.error(`[infinitepay-webhook] Cobrança não encontrada para order_nsu=${order_nsu}`);
      return jsonResponse({ error: "Cobranca not found", order_nsu }, 404);
    }

    console.log(`[infinitepay-webhook] Cobrança encontrada: id=${cobranca.id}, status_atual=${cobranca.status}`);

    // 3. NORMALIZAÇÃO VIA MÁQUINA DE ESTADOS
    const rawStatus = payload.status || payload.event || "paid";
    const { nextStatus, isPaymentConfirmed, amountPaid } = normalizeGatewayStatus("infinitepay", rawStatus, payload);

    if (!canTransition(cobranca.status, nextStatus)) {
      console.warn(`[infinitepay-webhook] Transição ignorada: ${cobranca.status} -> ${nextStatus}`);
      return jsonResponse({ success: true, message: "Ignored transition", currentStatus: cobranca.status });
    }

    // 4. ATUALIZAÇÃO DA COBRANÇA
    const now = new Date().toISOString();
    const updateData: Record<string, any> = {
      status: nextStatus,
      provider_transaction_id: transaction_nsu || null,
      ip_transaction_nsu: transaction_nsu || null,
      ip_receipt_url: receipt_url || null,
      updated_at: now,
    };

    if (isPaymentConfirmed) {
      updateData.data_pagamento = now;
      if (amountPaid) {
        updateData.valor_liquido = amountPaid;
      }
    }

    const { error: updateError } = await supabase
      .from("cobrancas")
      .update(updateData)
      .eq("id", cobranca.id);

    if (updateError) {
      console.error("[infinitepay-webhook] Erro ao atualizar cobrança:", updateError);
      return jsonResponse({ success: false, error: updateError.message }, 500);
    }

    // Atualizar log como processado com sucesso
    await supabase
      .from("webhook_logs")
      .update({ status: "processed" })
      .eq("order_nsu", order_nsu)
      .eq("provedor", "infinitepay");

    console.log(`[infinitepay-webhook] Cobrança ${cobranca.id} atualizada com sucesso para status=${nextStatus}`);

    return jsonResponse({
      success: true,
      cobrancaId: cobranca.id,
      status: nextStatus,
      valorPago: amountPaid || cobranca.valor,
    });
  } catch (error: any) {
    console.error("[infinitepay-webhook] Erro inesperado:", error);
    return jsonResponse({ success: false, error: error.message || "Unknown error" }, 500);
  }
});
