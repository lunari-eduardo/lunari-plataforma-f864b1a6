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
 * - Consulta a API do Asaas para obter status real de cada parcela
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
    let cobranca = null;
    let searchMethod = "";

    // 1. Buscar por cobrancaId (pode ser UUID ou ip_order_nsu)
    if (cobrancaId) {
      console.log(`[check-payment-status] 1st search: ip_order_nsu = ${cobrancaId}`);
      const { data: byNsu, error: nsuError } = await supabase
        .from("cobrancas")
        .select("*")
        .eq("ip_order_nsu", cobrancaId)
        .maybeSingle();

      if (nsuError) {
        console.error("[check-payment-status] Error searching by ip_order_nsu:", nsuError);
      }

      if (byNsu) {
        cobranca = byNsu;
        searchMethod = "by_ip_order_nsu";
        console.log(`[check-payment-status] Found by ip_order_nsu: ${byNsu.id}`);
      } else {
        console.log(`[check-payment-status] 2nd search (fallback): id = ${cobrancaId}`);
        const { data: byId, error: idError } = await supabase
          .from("cobrancas")
          .select("*")
          .eq("id", cobrancaId)
          .maybeSingle();

        if (idError) {
          console.error("[check-payment-status] Error searching by id:", idError);
        }

        if (byId) {
          cobranca = byId;
          searchMethod = "by_id";
          console.log(`[check-payment-status] Found by id: ${byId.id}`);
        }
      }
    }

    // 2. Buscar por orderNsu se não encontrou
    if (!cobranca && orderNsu) {
      console.log(`[check-payment-status] Searching by orderNsu: ${orderNsu}`);
      const { data: byNsu, error: nsuError } = await supabase
        .from("cobrancas")
        .select("*")
        .eq("ip_order_nsu", orderNsu)
        .maybeSingle();

      if (nsuError) {
        console.error("[check-payment-status] Error searching by orderNsu:", nsuError);
      }

      if (byNsu) {
        cobranca = byNsu;
        searchMethod = "by_ip_order_nsu_param";
        console.log(`[check-payment-status] Found by orderNsu: ${byNsu.id}`);
      }
    }

    // 3. Buscar por sessionId se não encontrou
    if (!cobranca && sessionId) {
      console.log(`[check-payment-status] Searching by sessionId: ${sessionId}`);
      const { data: bySession, error: sessionError } = await supabase
        .from("cobrancas")
        .select("*")
        .eq("session_id", sessionId)
        .eq("status", "pendente")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (sessionError) {
        console.error("[check-payment-status] Error searching by sessionId:", sessionError);
      }

      if (bySession) {
        cobranca = bySession;
        searchMethod = "by_session_id";
        console.log(`[check-payment-status] Found by sessionId: ${bySession.id}`);
      }
    }

    if (!cobranca) {
      console.log("[check-payment-status] Cobranca not found");
      return new Response(
        JSON.stringify({ found: false, error: "Cobranca not found" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 404 }
      );
    }

    console.log(`[check-payment-status] Found via ${searchMethod}: ${cobranca.id}, status: ${cobranca.status}, provedor: ${cobranca.provedor}`);

    // Se já está pago, retornar status
    if (cobranca.status === "pago") {
      return new Response(
        JSON.stringify({ 
          found: true, 
          status: "pago", 
          updated: false, 
          source: "already_paid",
          cobrancaId: cobranca.id 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    // ==========================================
    // ASAAS PROVIDER: Query API for real status
    // ==========================================
    if (cobranca.provedor === "asaas" && cobranca.asaas_installment_id) {
      console.log(`[check-payment-status] Asaas installment detected: ${cobranca.asaas_installment_id}`);
      return await handleAsaasInstallmentCheck(supabase, cobranca);
    }

    if (cobranca.provedor === "asaas" && cobranca.mp_payment_id) {
      // Single Asaas payment (no installment)
      console.log(`[check-payment-status] Asaas single payment detected: ${cobranca.mp_payment_id}`);
      return await handleAsaasSinglePaymentCheck(supabase, cobranca);
    }

    // ==========================================
    // NON-ASAAS PROVIDERS: forceUpdate fallback
    // ==========================================
    if (forceUpdate) {
      const now = new Date().toISOString();

      const { error: updateError } = await supabase
        .from("cobrancas")
        .update({
          status: "pago",
          data_pagamento: now,
          ip_transaction_nsu: "manual-verification",
          updated_at: now,
        })
        .eq("id", cobranca.id);

      if (updateError) {
        console.error("[check-payment-status] Error updating cobranca:", updateError);
        throw new Error("Failed to update cobranca");
      }

      console.log(`[check-payment-status] Non-Asaas cobranca ${cobranca.id} updated to 'pago' via forceUpdate`);

      return new Response(
        JSON.stringify({ 
          found: true, 
          status: "pago", 
          updated: true, 
          source: "manual_verification",
          cobrancaId: cobranca.id 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    // Retornar status atual sem modificar
    return new Response(
      JSON.stringify({ 
        found: true, 
        status: cobranca.status, 
        updated: false,
        cobranca: {
          id: cobranca.id,
          valor: cobranca.valor,
          status: cobranca.status,
          provedor: cobranca.provedor,
          createdAt: cobranca.created_at,
        }
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );

  } catch (error) {
    console.error("[check-payment-status] Error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});

// ==========================================
// Asaas API helpers
// ==========================================

function getAsaasConfig() {
  const apiKey = Deno.env.get("ASAAS_API_KEY");
  const env = Deno.env.get("ASAAS_ENV") || "sandbox";
  const baseUrl = env === "production"
    ? "https://api.asaas.com/v3"
    : "https://sandbox.asaas.com/api/v3";
  return { apiKey, baseUrl };
}

async function handleAsaasInstallmentCheck(supabase: any, cobranca: any) {
  const { apiKey, baseUrl } = getAsaasConfig();

  if (!apiKey) {
    console.error("[check-payment-status] ASAAS_API_KEY not configured");
    return new Response(
      JSON.stringify({ found: true, status: cobranca.status, updated: false, error: "ASAAS_API_KEY not configured" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  }

  try {
    // Fetch all payments for this installment from Asaas API
    const url = `${baseUrl}/payments?installment=${cobranca.asaas_installment_id}&limit=100`;
    console.log(`[check-payment-status] Fetching Asaas installment payments: ${url}`);

    const response = await fetch(url, {
      headers: { "access_token": apiKey },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[check-payment-status] Asaas API error: ${response.status} ${errorText}`);
      return new Response(
        JSON.stringify({ found: true, status: cobranca.status, updated: false, error: `Asaas API error: ${response.status}` }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    const data = await response.json();
    const payments = data.data || [];
    console.log(`[check-payment-status] Found ${payments.length} payments for installment ${cobranca.asaas_installment_id}`);

    let parcelasCreated = 0;
    let parcelasPagas = 0;

    for (const payment of payments) {
      const isPaid = ["CONFIRMED", "RECEIVED", "RECEIVED_IN_CASH"].includes(payment.status);
      const parcelaStatus = payment.status === "CONFIRMED" ? "confirmado"
        : payment.status === "RECEIVED" ? "recebido"
        : payment.status === "RECEIVED_IN_CASH" ? "recebido"
        : "pendente";

      if (isPaid) parcelasPagas++;

      const valorBruto = payment.value || 0;
      const valorLiquido = payment.netValue ?? null;
      const taxaGateway = valorLiquido != null
        ? Math.round((valorBruto - valorLiquido) * 100) / 100
        : 0;

      const parcelaData = {
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
      };

      console.log(`[check-payment-status] Upserting parcela ${payment.installmentNumber}: ${payment.id} status=${parcelaStatus} bruto=${valorBruto} liquido=${valorLiquido}`);

      const { error: upsertError } = await supabase
        .from("cobranca_parcelas")
        .upsert(parcelaData, { onConflict: "asaas_payment_id" });

      if (upsertError) {
        console.error(`[check-payment-status] Error upserting parcela:`, upsertError);
      } else {
        parcelasCreated++;
      }
    }

    // The reconcile_cobranca_from_parcelas trigger handles:
    // - Updating cobrancas.parcelas_pagas
    // - Updating cobrancas.valor_liquido
    // - Updating cobrancas.status to 'pago' when all parcelas are paid
    // - Which then fires ensure_transaction_on_cobranca_paid → creates clientes_transacoes

    // Re-fetch cobranca to get updated status (after triggers)
    const { data: updatedCobranca } = await supabase
      .from("cobrancas")
      .select("status, parcelas_pagas, total_parcelas, valor_liquido")
      .eq("id", cobranca.id)
      .single();

    const finalStatus = updatedCobranca?.status || cobranca.status;
    const wasUpdated = finalStatus !== cobranca.status;

    console.log(`[check-payment-status] Asaas check complete: ${parcelasCreated} parcelas upserted, ${parcelasPagas} paid. Final status: ${finalStatus}`);

    return new Response(
      JSON.stringify({
        found: true,
        status: finalStatus,
        updated: wasUpdated,
        source: "asaas_api_check",
        cobrancaId: cobranca.id,
        parcelas: {
          total: payments.length,
          pagas: parcelasPagas,
          synced: parcelasCreated,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error) {
    console.error("[check-payment-status] Error checking Asaas API:", error);
    return new Response(
      JSON.stringify({ found: true, status: cobranca.status, updated: false, error: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  }
}

async function handleAsaasSinglePaymentCheck(supabase: any, cobranca: any) {
  const { apiKey, baseUrl } = getAsaasConfig();

  if (!apiKey) {
    return new Response(
      JSON.stringify({ found: true, status: cobranca.status, updated: false, error: "ASAAS_API_KEY not configured" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  }

  try {
    const paymentId = cobranca.mp_payment_id;
    const url = `${baseUrl}/payments/${paymentId}`;
    console.log(`[check-payment-status] Fetching Asaas single payment: ${url}`);

    const response = await fetch(url, {
      headers: { "access_token": apiKey },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[check-payment-status] Asaas API error: ${response.status} ${errorText}`);
      return new Response(
        JSON.stringify({ found: true, status: cobranca.status, updated: false, error: `Asaas API error: ${response.status}` }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    const payment = await response.json();
    const isPaid = ["CONFIRMED", "RECEIVED", "RECEIVED_IN_CASH"].includes(payment.status);

    if (!isPaid) {
      console.log(`[check-payment-status] Asaas payment ${paymentId} not yet paid: ${payment.status}`);
      return new Response(
        JSON.stringify({ found: true, status: cobranca.status, updated: false, source: "asaas_api_check" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    // Create parcela for fee tracking
    const valorBruto = payment.value || cobranca.valor;
    const valorLiquido = payment.netValue ?? null;
    const taxaGateway = valorLiquido != null
      ? Math.round((valorBruto - valorLiquido) * 100) / 100
      : 0;
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

    return new Response(
      JSON.stringify({
        found: true,
        status: finalStatus,
        updated: finalStatus !== cobranca.status,
        source: "asaas_api_check",
        cobrancaId: cobranca.id,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error) {
    console.error("[check-payment-status] Error checking Asaas single payment:", error);
    return new Response(
      JSON.stringify({ found: true, status: cobranca.status, updated: false, error: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  }
}
