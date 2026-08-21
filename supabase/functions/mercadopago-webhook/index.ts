// supabase/functions/mercadopago-webhook/index.ts
// Webhook do Mercado Pago com reconciliação determinística O(1) e máquina de estados

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.2";
import { corsHeaders, jsonResponse } from "../_shared/auth-guard.ts";
import { normalizeGatewayStatus, canTransition } from "../_shared/state-machine.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    let body: any = {};
    const url = new URL(req.url);
    const topic = url.searchParams.get("topic") || url.searchParams.get("type");
    const idFromQuery = url.searchParams.get("id") || url.searchParams.get("data.id");

    try {
      body = await req.json();
    } catch {
      // Notificação IPN do Mercado Pago pode vir apenas via query params
    }

    console.log("[mercadopago-webhook] Recebido:", JSON.stringify({ body, query: Object.fromEntries(url.searchParams.entries()) }));

    // 1. Log preliminar do webhook para auditoria
    await supabase.from("webhook_logs").insert({
      provedor: "mercadopago",
      payload: { body, query: Object.fromEntries(url.searchParams.entries()) },
      headers: Object.fromEntries(req.headers.entries()),
      status: "received",
    }).then(() => {}, (err) => console.warn("[mercadopago-webhook] Falha no log:", err));

    const type = body.type || topic;
    const action = body.action;
    const paymentId = body.data?.id || idFromQuery;

    if (!paymentId || (type !== "payment" && !action?.includes("payment") && topic !== "payment")) {
      console.log("[mercadopago-webhook] Evento ignorado (não é de pagamento ou ID ausente):", { type, action, paymentId });
      return jsonResponse({ received: true });
    }

    console.log(`[mercadopago-webhook] Processando pagamento Mercado Pago: ${paymentId}`);

    // 2. BUSCA O(1) DA COBRANÇA NO BANCO
    let { data: cobranca } = await supabase
      .from("cobrancas")
      .select("*")
      .or(`mp_payment_id.eq.${paymentId},provider_transaction_id.eq.${paymentId},id.eq.${paymentId}`)
      .maybeSingle();

    let paymentData: any = null;

    // Se a cobrança já foi encontrada, usamos o token do fotógrafo dono para consultar dados de taxas atualizados
    if (cobranca) {
      const { data: integ } = await supabase
        .from("usuarios_integracoes")
        .select("access_token")
        .eq("user_id", cobranca.user_id)
        .eq("provedor", "mercadopago")
        .eq("status", "ativo")
        .maybeSingle();

      if (integ?.access_token) {
        try {
          const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
            headers: { Authorization: `Bearer ${integ.access_token}` },
          });
          if (mpRes.ok) {
            paymentData = await mpRes.json();
          }
        } catch (e) {
          console.warn("[mercadopago-webhook] Falha não impeditiva ao consultar pagamento no MP:", e);
        }
      }
    } else {
      // Cobrança não encontrada por payment_id (ex: pagamento via Link de Preferência onde payment_id só nasce agora)
      // Fazemos busca por token do fotógrafo ou varredura de integrações
      const { data: integrations } = await supabase
        .from("usuarios_integracoes")
        .select("user_id, access_token")
        .eq("provedor", "mercadopago")
        .eq("status", "ativo");

      for (const integ of integrations || []) {
        if (!integ.access_token) continue;
        try {
          const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
            headers: { Authorization: `Bearer ${integ.access_token}` },
          });
          if (mpRes.ok) {
            paymentData = await mpRes.json();
            break;
          }
        } catch {
          // Continua busca
        }
      }

      if (paymentData) {
        // Reconciliação direta por external_reference (cobranca.id) ou preference_id
        if (paymentData.external_reference) {
          const { data: byExtRef } = await supabase
            .from("cobrancas")
            .select("*")
            .eq("id", paymentData.external_reference)
            .maybeSingle();
          if (byExtRef) cobranca = byExtRef;
        }

        if (!cobranca && paymentData.preference_id) {
          const { data: byPref } = await supabase
            .from("cobrancas")
            .select("*")
            .or(`mp_preference_id.eq.${paymentData.preference_id},provider_order_id.eq.${paymentData.preference_id}`)
            .maybeSingle();
          if (byPref) cobranca = byPref;
        }
      }
    }

    if (!cobranca) {
      console.warn(`[mercadopago-webhook] Nenhuma cobrança encontrada para payment_id=${paymentId}`);
      return jsonResponse({ received: true, not_found: true });
    }

    // 3. NORMALIZAÇÃO DO EVENTO VIA MÁQUINA DE ESTADOS
    const rawStatus = paymentData?.status || "approved";
    const { nextStatus, isPaymentConfirmed } = normalizeGatewayStatus("mercadopago", rawStatus, paymentData);

    console.log(`[mercadopago-webhook] Transição: status_atual=${cobranca.status} -> proximo_status=${nextStatus} (raw=${rawStatus})`);

    if (!canTransition(cobranca.status, nextStatus)) {
      console.warn(`[mercadopago-webhook] Transição inválida ignorada: ${cobranca.status} -> ${nextStatus}`);
      return jsonResponse({ received: true, skipped_transition: true });
    }

    // 4. ATUALIZAR COBRANÇA
    const netReceived = paymentData?.transaction_details?.net_received_amount ?? null;
    const updateData: Record<string, any> = {
      status: nextStatus,
      mp_payment_id: String(paymentId),
      provider_transaction_id: String(paymentId),
      updated_at: new Date().toISOString(),
    };

    if (isPaymentConfirmed) {
      updateData.data_pagamento = new Date().toISOString();
      if (netReceived !== null && netReceived !== undefined) {
        updateData.valor_liquido = netReceived;
      }
    }

    const { error: updateError } = await supabase
      .from("cobrancas")
      .update(updateData)
      .eq("id", cobranca.id);

    if (updateError) {
      console.error("[mercadopago-webhook] Erro ao atualizar cobrança:", updateError);
      return jsonResponse({ received: false, error: updateError.message }, 500);
    }

    console.log(`[mercadopago-webhook] Cobrança ${cobranca.id} atualizada com sucesso para status=${nextStatus}`);

    // Disparo de e-mail de pagamento confirmado se aplicável
    if (isPaymentConfirmed) {
      try {
        fetch(`${SUPABASE_URL}/functions/v1/send-email`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          },
          body: JSON.stringify({
            eventType: "payment_confirmed",
            paymentId: cobranca.id,
            galleryId: cobranca.galeria_id || undefined,
          }),
        }).catch((e) => console.warn("[mercadopago-webhook] send-email async error:", e));
      } catch (e) {
        console.warn("[mercadopago-webhook] send-email error:", e);
      }
    }

    return jsonResponse({ received: true, status: nextStatus, cobrancaId: cobranca.id });
  } catch (error: any) {
    console.error("[mercadopago-webhook] Erro inesperado:", error);
    return jsonResponse({ received: true, error: error.message });
  }
});
