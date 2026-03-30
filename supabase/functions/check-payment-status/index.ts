import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

/**
 * CONTRATO OFICIAL: Fallback obrigatório para verificação manual de pagamentos
 * 
 * Lógica de resolução segue a mesma ordem do webhook:
 * 1º: Buscar por ip_order_nsu = identifier
 * 2º: Fallback por id = identifier
 * 
 * Para cobranças Asaas com parcelas:
 * - Consulta a API do Asaas usando a chave do FOTÓGRAFO (usuarios_integracoes)
 * - Cria/atualiza cobranca_parcelas com dados de taxas
 * - Deixa o trigger reconcile_cobranca_from_parcelas atualizar o status da cobrança
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const { cobrancaId, orderNsu, sessionId, forceUpdate } = await req.json();

    console.log("[check-payment-status] Request:", { cobrancaId, orderNsu, sessionId, forceUpdate });

    // RESOLUÇÃO SEGUE MESMA ORDEM DO WEBHOOK: ip_order_nsu → id
    const cobranca = await findCobranca(supabase, { cobrancaId, orderNsu, sessionId });

    if (!cobranca) {
      console.log("[check-payment-status] Cobranca not found");
      return jsonResponse({ found: false, error: "Cobranca not found" }, 404);
    }

    console.log(`[check-payment-status] Found: ${cobranca.id}, status: ${cobranca.status}, provedor: ${cobranca.provedor}`);

    // Já pago — retornar
    if (cobranca.status === "pago") {
      return jsonResponse({ found: true, status: "pago", updated: false, source: "already_paid", cobrancaId: cobranca.id });
    }

    // ASAAS: Query API do fotógrafo para status real
    if (cobranca.provedor === "asaas") {
      const asaasConfig = await getPhotographerAsaasConfig(supabase, cobranca.user_id);

      if (!asaasConfig) {
        console.error("[check-payment-status] No Asaas integration found for user:", cobranca.user_id);
        return jsonResponse({ found: true, status: cobranca.status, updated: false, error: "No Asaas integration for this photographer" });
      }

      if (cobranca.asaas_installment_id) {
        return await handleAsaasInstallmentCheck(supabase, cobranca, asaasConfig);
      }

      if (cobranca.mp_payment_id) {
        return await handleAsaasSinglePaymentCheck(supabase, cobranca, asaasConfig);
      }
    }

    // NON-ASAAS: forceUpdate fallback
    if (forceUpdate) {
      const now = new Date().toISOString();
      const { error: updateError } = await supabase
        .from("cobrancas")
        .update({ status: "pago", data_pagamento: now, ip_transaction_nsu: "manual-verification", updated_at: now })
        .eq("id", cobranca.id);

      if (updateError) {
        console.error("[check-payment-status] Error updating cobranca:", updateError);
        throw new Error("Failed to update cobranca");
      }

      console.log(`[check-payment-status] Non-Asaas cobranca ${cobranca.id} updated to 'pago' via forceUpdate`);
      return jsonResponse({ found: true, status: "pago", updated: true, source: "manual_verification", cobrancaId: cobranca.id });
    }

    // Retornar status atual
    return jsonResponse({
      found: true,
      status: cobranca.status,
      updated: false,
      cobranca: { id: cobranca.id, valor: cobranca.valor, status: cobranca.status, provedor: cobranca.provedor, createdAt: cobranca.created_at },
    });

  } catch (error) {
    console.error("[check-payment-status] Error:", error);
    return jsonResponse({ success: false, error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
});

// ==========================================
// Helpers
// ==========================================

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status,
  });
}

async function findCobranca(supabase: any, { cobrancaId, orderNsu, sessionId }: any) {
  // 1. By cobrancaId (ip_order_nsu first, then id)
  if (cobrancaId) {
    const { data: byNsu } = await supabase.from("cobrancas").select("*").eq("ip_order_nsu", cobrancaId).maybeSingle();
    if (byNsu) return byNsu;

    const { data: byId } = await supabase.from("cobrancas").select("*").eq("id", cobrancaId).maybeSingle();
    if (byId) return byId;
  }

  // 2. By orderNsu
  if (orderNsu) {
    const { data: byNsu } = await supabase.from("cobrancas").select("*").eq("ip_order_nsu", orderNsu).maybeSingle();
    if (byNsu) return byNsu;
  }

  // 3. By sessionId
  if (sessionId) {
    const { data: bySession } = await supabase
      .from("cobrancas").select("*").eq("session_id", sessionId).eq("status", "pendente")
      .order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (bySession) return bySession;
  }

  return null;
}

/** Get Asaas API config from the photographer's integration (not platform env var) */
async function getPhotographerAsaasConfig(supabase: any, userId: string) {
  const { data: integracao, error } = await supabase
    .from("usuarios_integracoes")
    .select("access_token, dados_extras")
    .eq("user_id", userId)
    .eq("provedor", "asaas")
    .eq("status", "ativo")
    .maybeSingle();

  if (error) {
    console.error("[check-payment-status] Error fetching photographer integration:", error);
    return null;
  }

  if (!integracao?.access_token) {
    // Fallback to platform env var (for backwards compat / platform-owned accounts)
    const platformKey = Deno.env.get("ASAAS_API_KEY");
    if (!platformKey) return null;
    const env = Deno.env.get("ASAAS_ENV") || "sandbox";
    const baseUrl = env === "production" ? "https://api.asaas.com/v3" : "https://sandbox.asaas.com/api/v3";
    console.log("[check-payment-status] Using platform ASAAS_API_KEY as fallback");
    return { apiKey: platformKey, baseUrl };
  }

  const env = integracao.dados_extras?.environment || integracao.dados_extras?.gestao_settings?.environment || "sandbox";
  const baseUrl = env === "production" ? "https://api.asaas.com/v3" : "https://sandbox.asaas.com/api/v3";

  console.log(`[check-payment-status] Using photographer's Asaas key (env: ${env})`);
  return { apiKey: integracao.access_token, baseUrl };
}

async function handleAsaasInstallmentCheck(supabase: any, cobranca: any, config: { apiKey: string; baseUrl: string }) {
  try {
    const url = `${config.baseUrl}/payments?installment=${cobranca.asaas_installment_id}&limit=100`;
    console.log(`[check-payment-status] Fetching Asaas installment payments: ${url}`);

    const response = await fetch(url, { headers: { "access_token": config.apiKey } });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[check-payment-status] Asaas API error: ${response.status} ${errorText}`);
      return jsonResponse({ found: true, status: cobranca.status, updated: false, error: `Asaas API error: ${response.status}` });
    }

    const data = await response.json();
    const payments = data.data || [];
    console.log(`[check-payment-status] Found ${payments.length} payments for installment ${cobranca.asaas_installment_id}`);

    let parcelasCreated = 0;
    let parcelasPagas = 0;

    for (const payment of payments) {
      const isPaid = ["CONFIRMED", "RECEIVED", "RECEIVED_IN_CASH"].includes(payment.status);
      const parcelaStatus = isPaid
        ? (payment.status === "CONFIRMED" ? "confirmado" : "recebido")
        : "pendente";

      if (isPaid) parcelasPagas++;

      // REGRA: valor_bruto = valor original do fotógrafo por parcela (não o inflado do Asaas)
      const valorBruto = cobranca.total_parcelas > 0
        ? Math.round((cobranca.valor / cobranca.total_parcelas) * 100) / 100
        : cobranca.valor;
      const valorLiquido = payment.netValue ?? null;
      const taxaGateway = valorLiquido != null ? Math.max(0, Math.round((valorBruto - valorLiquido) * 100) / 100) : 0;

      const { error: upsertError } = await supabase
        .from("cobranca_parcelas")
        .upsert({
          cobranca_id: cobranca.id,
          numero_parcela: payment.installmentNumber || 1,
          asaas_payment_id: payment.id,
          valor_bruto: valorBruto,
          valor_liquido: valorLiquido,
          taxa_gateway: taxaGateway,
          status: parcelaStatus,
          billing_type: payment.billingType || null,
          data_pagamento: isPaid ? (payment.paymentDate || new Date().toISOString()) : null,
          data_vencimento: payment.dueDate || null,
          data_credito: payment.creditDate || null,
          updated_at: new Date().toISOString(),
        }, { onConflict: "asaas_payment_id" });

      if (upsertError) {
        console.error(`[check-payment-status] Error upserting parcela:`, upsertError);
      } else {
        parcelasCreated++;
      }
    }

    // Re-fetch cobranca to get trigger-updated status
    const { data: updatedCobranca } = await supabase
      .from("cobrancas")
      .select("status, parcelas_pagas, total_parcelas, valor_liquido")
      .eq("id", cobranca.id)
      .single();

    const finalStatus = updatedCobranca?.status || cobranca.status;

    console.log(`[check-payment-status] Asaas installment check complete: ${parcelasCreated} parcelas upserted, ${parcelasPagas} paid. Final status: ${finalStatus}`);

    return jsonResponse({
      found: true,
      status: finalStatus,
      updated: finalStatus !== cobranca.status,
      source: "asaas_api_check",
      cobrancaId: cobranca.id,
      parcelas: { total: payments.length, pagas: parcelasPagas, synced: parcelasCreated },
    });
  } catch (error) {
    console.error("[check-payment-status] Error checking Asaas API:", error);
    return jsonResponse({ found: true, status: cobranca.status, updated: false, error: error.message });
  }
}

async function handleAsaasSinglePaymentCheck(supabase: any, cobranca: any, config: { apiKey: string; baseUrl: string }) {
  try {
    const paymentId = cobranca.mp_payment_id;
    const url = `${config.baseUrl}/payments/${paymentId}`;
    console.log(`[check-payment-status] Fetching Asaas single payment: ${url}`);

    const response = await fetch(url, { headers: { "access_token": config.apiKey } });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[check-payment-status] Asaas API error: ${response.status} ${errorText}`);
      return jsonResponse({ found: true, status: cobranca.status, updated: false, error: `Asaas API error: ${response.status}` });
    }

    const payment = await response.json();
    const isPaid = ["CONFIRMED", "RECEIVED", "RECEIVED_IN_CASH"].includes(payment.status);

    if (!isPaid) {
      console.log(`[check-payment-status] Asaas payment ${paymentId} not yet paid: ${payment.status}`);
      return jsonResponse({ found: true, status: cobranca.status, updated: false, source: "asaas_api_check" });
    }

    // Create parcela for fee tracking
    // REGRA: valor_bruto = valor original do fotógrafo (não o inflado do Asaas)
    const valorBruto = cobranca.valor;
    const valorLiquido = payment.netValue ?? null;
    const taxaGateway = valorLiquido != null ? Math.max(0, Math.round((valorBruto - valorLiquido) * 100) / 100) : 0;
    const parcelaStatus = payment.status === "CONFIRMED" ? "confirmado" : "recebido";

    const { error: upsertError } = await supabase
      .from("cobranca_parcelas")
      .upsert({
        cobranca_id: cobranca.id,
        numero_parcela: 1,
        asaas_payment_id: payment.id,
        valor_bruto: valorBruto,
        valor_liquido: valorLiquido,
        taxa_gateway: taxaGateway,
        status: parcelaStatus,
        billing_type: payment.billingType || null,
        data_pagamento: payment.paymentDate || new Date().toISOString(),
        data_vencimento: payment.dueDate || null,
        data_credito: payment.creditDate || null,
        updated_at: new Date().toISOString(),
      }, { onConflict: "asaas_payment_id" });

    if (upsertError) {
      console.error("[check-payment-status] Error upserting single parcela:", upsertError);
    }

    // Re-fetch to get trigger-updated status
    const { data: updatedCobranca } = await supabase
      .from("cobrancas")
      .select("status")
      .eq("id", cobranca.id)
      .single();

    const finalStatus = updatedCobranca?.status || cobranca.status;

    console.log(`[check-payment-status] Asaas single payment check: status=${finalStatus}, liquido=${valorLiquido}`);

    return jsonResponse({
      found: true,
      status: finalStatus,
      updated: finalStatus !== cobranca.status,
      source: "asaas_api_check",
      cobrancaId: cobranca.id,
    });
  } catch (error) {
    console.error("[check-payment-status] Error checking Asaas single payment:", error);
    return jsonResponse({ found: true, status: cobranca.status, updated: false, error: error.message });
  }
}
