// ⚠️ PLATAFORMA LUNARI — webhook das assinaturas Lunari e cobranças de fotógrafos.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getPlatformAsaasConfig } from "../_shared/platform-asaas.ts";
import { enrichClienteIfMissing } from "../_shared/enrich-cliente.ts";

/**
 * Enriquece o cadastro do cliente com dados vindos do Asaas após pagamento
 * confirmado. Fire-and-forget: nunca falha o webhook por erro de enrich.
 */
async function enrichClienteFromAsaasPayment(
  adminClient: any,
  cobrancaId: string,
  asaasCustomerId: string,
  photographerUserId: string,
) {
  try {
    const { data: integ } = await adminClient
      .from("usuarios_integracoes")
      .select("access_token, dados_extras")
      .eq("user_id", photographerUserId)
      .eq("provedor", "asaas")
      .eq("status", "ativo")
      .order("is_default", { ascending: false })
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!integ?.access_token) return;
    const env = (integ.dados_extras as any)?.environment === "production" ? "production" : "sandbox";
    const baseUrl = env === "production" ? "https://api.asaas.com" : "https://api-sandbox.asaas.com";

    const custRes = await fetch(`${baseUrl}/v3/customers/${asaasCustomerId}`, {
      headers: { access_token: integ.access_token },
    });
    if (!custRes.ok) {
      console.warn(`[enrich] GET customer ${asaasCustomerId} → ${custRes.status}`);
      await custRes.text().catch(() => {});
      return;
    }
    const cust = await custRes.json();

    const { data: cobranca } = await adminClient
      .from("cobrancas")
      .select("cliente_id")
      .eq("id", cobrancaId)
      .maybeSingle();
    if (!cobranca?.cliente_id) return;

    const result = await enrichClienteIfMissing(adminClient, cobranca.cliente_id, {
      email: cust.email,
      telefone: cust.mobilePhone || cust.phone,
      cpfCnpj: cust.cpfCnpj,
      cep: cust.postalCode,
      endereco: cust.address,
      enderecoNumero: cust.addressNumber,
      enderecoComplemento: cust.complement,
      bairro: cust.province,
      cidade: cust.city || cust.cityName,
      uf: cust.state,
    });
    if (result.updated) {
      console.log(`[enrich] cliente ${cobranca.cliente_id} → ${result.fields.join(",")}`);
    }
  } catch (err) {
    console.warn("[enrich] failed (ignored):", err);
  }
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GB = 1024 * 1024 * 1024;
const STORAGE_LIMITS: Record<string, number> = {
  transfer_5gb: 5 * GB,
  transfer_20gb: 20 * GB,
  transfer_50gb: 50 * GB,
  transfer_100gb: 100 * GB,
  combo_completo: 20 * GB,
};

const PLAN_SUBSCRIPTION_CREDITS: Record<string, number> = {
  combo_pro_select2k: 2000,
  combo_completo: 2000,
};

const PLAN_PRICES: Record<string, { monthly: number; yearly: number }> = {
  studio_starter: { monthly: 1490, yearly: 15198 },
  studio_pro: { monthly: 3590, yearly: 36618 },
  transfer_5gb: { monthly: 1290, yearly: 12384 },
  transfer_20gb: { monthly: 2490, yearly: 23904 },
  transfer_50gb: { monthly: 3490, yearly: 33504 },
  transfer_100gb: { monthly: 5990, yearly: 57504 },
  combo_pro_select2k: { monthly: 4490, yearly: 45259 },
  combo_completo: { monthly: 6490, yearly: 66198 },
};

async function applyDowngrade(adminClient: any, subscription: any) {
  const newPlanType = subscription.pending_downgrade_plan;
  const newCycle = subscription.pending_downgrade_cycle || subscription.billing_cycle;

  if (!newPlanType) return;

  console.log(`Applying scheduled downgrade: ${subscription.plan_type} → ${newPlanType}`);

  const platformCfg = await getPlatformAsaasConfig(adminClient);
  if (!platformCfg) {
    console.error("Platform Asaas integration not configured, cannot apply downgrade");
    return;
  }
  const ASAAS_API_KEY = platformCfg.apiKey;
  const ASAAS_BASE_URL = platformCfg.baseUrl;

  const userId = subscription.user_id;

  if (subscription.asaas_subscription_id) {
    const cancelRes = await fetch(
      `${ASAAS_BASE_URL}/v3/subscriptions/${subscription.asaas_subscription_id}`,
      { method: "DELETE", headers: { access_token: ASAAS_API_KEY } }
    );
    if (!cancelRes.ok) {
      console.error("Failed to cancel old subscription in Asaas:", await cancelRes.text());
    }
  }

  await adminClient
    .from("subscriptions_asaas")
    .update({
      status: "CANCELLED",
      pending_downgrade_plan: null,
      pending_downgrade_cycle: null,
    })
    .eq("id", subscription.id);

  const { data: account } = await adminClient
    .from("photographer_accounts")
    .select("asaas_customer_id")
    .eq("user_id", userId)
    .single();

  if (!account?.asaas_customer_id) {
    console.error("No customer ID found for user:", userId);
    return;
  }

  const newPrices = PLAN_PRICES[newPlanType];
  if (!newPrices) {
    console.error("Unknown plan type for pricing:", newPlanType);
    return;
  }
  const newValueCents = newCycle === "YEARLY" ? newPrices.yearly : newPrices.monthly;
  const newValueReais = newValueCents / 100;

  const creditCardToken = subscription.metadata?.creditCardToken;

  const nextDueDate = new Date();
  nextDueDate.setDate(nextDueDate.getDate() + (newCycle === "YEARLY" ? 365 : 30));
  const nextDueDateStr = nextDueDate.toISOString().split("T")[0];

  const newSubPayload: Record<string, unknown> = {
    customer: account.asaas_customer_id,
    billingType: "CREDIT_CARD",
    cycle: newCycle,
    value: newValueReais,
    nextDueDate: nextDueDateStr,
    description: `${newPlanType} - ${newCycle === "YEARLY" ? "Anual" : "Mensal"}`,
    externalReference: userId,
  };

  if (creditCardToken) {
    newSubPayload.creditCardToken = creditCardToken;
  }

  const newSubRes = await fetch(`${ASAAS_BASE_URL}/v3/subscriptions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", access_token: ASAAS_API_KEY },
    body: JSON.stringify(newSubPayload),
  });

  const newSubData = await newSubRes.json();
  if (!newSubRes.ok) {
    console.error("Failed to create downgraded subscription:", newSubData);
    return;
  }

  await adminClient.from("subscriptions_asaas").insert({
    user_id: userId,
    asaas_customer_id: account.asaas_customer_id,
    asaas_subscription_id: newSubData.id,
    plan_type: newPlanType,
    billing_cycle: newCycle,
    status: newSubData.status || "ACTIVE",
    value_cents: newValueCents,
    next_due_date: newSubData.nextDueDate || nextDueDateStr,
    metadata: {
      creditCardToken: newSubData.creditCard?.creditCardToken || creditCardToken,
      downgraded_from: subscription.plan_type,
    },
  });

  const newLimit = STORAGE_LIMITS[newPlanType] || 0;

  const { data: storageData } = await adminClient.rpc("get_transfer_storage_bytes", {
    _user_id: userId,
  });
  const storageUsed = (storageData as number) || 0;

  if (storageUsed > newLimit) {
    console.log(`OVER LIMIT: ${storageUsed} bytes used, limit is ${newLimit} bytes.`);

    const deletionDate = new Date();
    deletionDate.setDate(deletionDate.getDate() + 30);

    await adminClient
      .from("photographer_accounts")
      .update({
        account_over_limit: true,
        over_limit_since: new Date().toISOString(),
        deletion_scheduled_at: deletionDate.toISOString(),
      })
      .eq("user_id", userId);

    await adminClient
      .from("galerias")
      .update({ status: "expired_due_to_plan" })
      .eq("user_id", userId)
      .eq("tipo", "entrega")
      .in("status", ["enviado", "rascunho"]);

    console.log(`All Transfer galleries expired. Deletion scheduled for ${deletionDate.toISOString()}`);
  }

  console.log(`Downgrade complete: new subscription ${newSubData.id}, plan ${newPlanType}`);
}

async function checkAndLogEvent(
  adminClient: any,
  eventType: string,
  eventId: string,
  payload: any
): Promise<boolean> {
  if (!eventId) return false;

  // Try insert with ON CONFLICT DO NOTHING
  const { data, error } = await adminClient
    .from("gateway_events")
    .insert({
      event_type: eventType,
      provider: "asaas",
      provider_event_id: eventId,
      payload,
      processed: false,
    })
    .select("id, processed")
    .maybeSingle();

  if (error) {
    if (error.code === "23505") {
      const { data: existing } = await adminClient
        .from("gateway_events")
        .select("processed")
        .eq("provider", "asaas")
        .eq("provider_event_id", eventId)
        .maybeSingle();

      if (existing?.processed) {
        console.log(`⏭️ Event ${eventId} already processed, skipping`);
        return true;
      }
      return false;
    }
    console.error("Error logging webhook event:", error);
    return false;
  }

  return false;
}

async function markEventProcessed(adminClient: any, eventId: string) {
  await adminClient
    .from("gateway_events")
    .update({ processed: true, processed_at: new Date().toISOString() })
    .eq("provider", "asaas")
    .eq("provider_event_id", eventId);
}

async function findCobranca(adminClient: any, payment: any) {
  // 1. Busca prioritária O(1) por externalReference (UUID da cobrança Lunari)
  if (payment?.externalReference) {
    const { data } = await adminClient
      .from("cobrancas")
      .select("id, status, valor, valor_principal, valor_cobrado_cliente, total_parcelas, asaas_installment_id, dados_extras, user_id, galeria_id, finalidade")
      .eq("id", payment.externalReference)
      .maybeSingle();
    if (data) return data;
  }

  // 2. Busca por asaas_installment_id / provider_order_id (grupo parcelado)
  if (payment?.installment) {
    const { data } = await adminClient
      .from("cobrancas")
      .select("id, status, valor, valor_principal, valor_cobrado_cliente, total_parcelas, asaas_installment_id, dados_extras, user_id, galeria_id, finalidade")
      .or(`asaas_installment_id.eq.${payment.installment},provider_order_id.eq.${payment.installment}`)
      .maybeSingle();
    if (data) return data;
  }

  // 3. Busca por payment.id
  if (payment?.id) {
    const { data } = await adminClient
      .from("cobrancas")
      .select("id, status, valor, valor_principal, valor_cobrado_cliente, total_parcelas, asaas_installment_id, dados_extras, user_id, galeria_id, finalidade")
      .or(`asaas_payment_id.eq.${payment.id},provider_order_id.eq.${payment.id},provider_transaction_id.eq.${payment.id},mp_payment_id.eq.${payment.id}`)
      .maybeSingle();
    if (data) return data;
  }

  return null;
}

function getStatusRank(status: string | null | undefined): number {
  switch (status?.toLowerCase()) {
    case "pendente":
    case "agendado":
    case "aguardando":
      return 1;
    case "parcialmente_pago":
      return 2;
    case "confirmado":
      return 3;
    case "recebido":
    case "antecipado":
      return 4;
    case "estornado":
    case "restituido":
    case "chargeback":
    case "cancelado":
    case "reprovado":
      return 5;
    default:
      return 0;
  }
}

async function upsertParcela(
  adminClient: any,
  cobrancaId: string,
  payment: any,
  status: string,
  cobranca?: any
) {
  const totalParcelas = cobranca?.total_parcelas && cobranca.total_parcelas > 0 ? cobranca.total_parcelas : 1;

  // 1. Decomposição dos valores nominais e de repasse
  // valorPrincipal é estritamente o valor comercial da venda
  const valorPrincipalCob = Number(
    cobranca?.valor_principal ?? 
    cobranca?.dados_extras?.valorBase ?? 
    cobranca?.valor ?? 
    payment.value ?? 
    0
  );
  // valorCobrado é o valor total com taxas transacionado no gateway
  const valorCobradoCob = Number(
    payment.value ?? 
    cobranca?.valor_cobrado_cliente ?? 
    cobranca?.dados_extras?.valorComTaxas ?? 
    valorPrincipalCob
  );

  const valorPrincipalParcela = Math.round((valorPrincipalCob / totalParcelas) * 100) / 100;
  const valorCobradoParcela = Math.round((valorCobradoCob / totalParcelas) * 100) / 100;
  const valorRepassadoParcela = Math.max(0, Math.round((valorCobradoParcela - valorPrincipalParcela) * 100) / 100);

  // 2. Valores reais transacionados pelo Asaas
  const valorBrutoTransacionado = payment.value != null ? Number(payment.value) : valorCobradoParcela;
  let valorLiquidoAsaas = payment.netValue != null ? Number(payment.netValue) : valorBrutoTransacionado;

  // Taxa de processamento real retida pelo gateway
  let taxaGatewayReal = Math.max(0, Math.round((valorBrutoTransacionado - valorLiquidoAsaas) * 100) / 100);

  // 3. Guarda de ordem de status e preservação de taxas históricas
  const { data: existingParcela } = await adminClient
    .from("cobranca_parcelas")
    .select("id, status, taxa_gateway, taxa_processamento_real, taxa_antecipacao, taxa_antecipacao_real, valor_liquido, valor_liquido_creditado, data_credito_real")
    .eq("asaas_payment_id", payment.id)
    .maybeSingle();

  // Se o webhook atual enviou netValue == value (comum em PAYMENT_ANTICIPATED) mas já temos taxa_processamento confirmada, preserva!
  if (taxaGatewayReal === 0 && Number(existingParcela?.taxa_processamento_real || existingParcela?.taxa_gateway || 0) > 0) {
    taxaGatewayReal = Number(existingParcela.taxa_processamento_real || existingParcela.taxa_gateway);
    valorLiquidoAsaas = Math.max(0, Math.round((valorBrutoTransacionado - taxaGatewayReal) * 100) / 100);
  }

  const currentRank = getStatusRank(existingParcela?.status);
  const newRank = getStatusRank(status);
  const finalStatus = currentRank > newRank ? existingParcela!.status : status;

  const existingAntFee = Number(existingParcela?.taxa_antecipacao_real ?? existingParcela?.taxa_antecipacao ?? 0);
  const existingCreditReal = existingParcela?.data_credito_real || (finalStatus === "recebido" ? (payment.creditDate || null) : null);
  
  // Líquido efetivamente creditado após todas as taxas conhecidas
  const finalLiquidoCreditado = existingAntFee > 0
    ? Math.max(0, Math.round((valorLiquidoAsaas - existingAntFee) * 100) / 100)
    : valorLiquidoAsaas;

  const parcelaData: Record<string, unknown> = {
    cobranca_id: cobrancaId,
    numero_parcela: payment.installmentNumber || 1,
    asaas_payment_id: payment.id,
    valor_bruto: valorPrincipalParcela, // Valor nominal comercial do serviço
    valor_principal: valorPrincipalParcela,
    valor_cobrado_cliente: valorCobradoParcela,
    valor_repassado_cliente: valorRepassadoParcela,
    taxa_gateway: taxaGatewayReal,
    taxa_processamento_real: taxaGatewayReal,
    taxa_antecipacao: existingAntFee,
    taxa_antecipacao_real: existingAntFee,
    valor_liquido: valorLiquidoAsaas,
    valor_liquido_creditado: finalLiquidoCreditado,
    status: finalStatus,
    billing_type: payment.billingType || null,
    data_vencimento: payment.dueDate || null,
    data_pagamento: payment.paymentDate || payment.confirmedDate || null,
    data_pagamento_gateway: payment.paymentDate || payment.confirmedDate || null,
    data_credito: payment.creditDate || null,
    data_credito_real: existingCreditReal,
    antecipado: payment.anticipated || existingParcela?.status === "antecipado" || false,
    updated_at: new Date().toISOString(),
  };

  // Upsert com foco na chave única natural do Asaas
  const { error } = await adminClient
    .from("cobranca_parcelas")
    .upsert(parcelaData, { onConflict: "asaas_payment_id" })
    .select()
    .maybeSingle();

  if (error) {
    console.error(`Error upserting parcela ${payment.id}:`, error);
    return false;
  }

  console.log(`✅ Parcela ${payment.id} → status=${finalStatus}, principal=${valorPrincipalParcela}, repasse=${valorRepassadoParcela}, liqAsaas=${valorLiquidoAsaas}, taxaProc=${taxaGatewayReal}, taxaAnt=${existingAntFee}`);
  return true;
}

/**
 * Sincroniza antecipações Asaas: consulta a API para payloads incompletos,
 * grava em gateway_anticipations, atualiza cobranca_parcelas (data_credito_real,
 * taxa_antecipacao_real, valor_liquido_creditado) e alinha o razão de caixa.
 */
async function syncAnticipationForPayment(
  adminClient: any,
  cobranca: any,
  payment: any,
  parcelaId: string,
  providedAnticipation?: any
) {
  try {
    let anticipation = providedAnticipation;

    // Se não foi fornecido no payload, consultar API do Asaas com a chave do fotógrafo
    if (!anticipation && cobranca?.user_id && payment?.id) {
      const { data: integ } = await adminClient
        .from("usuarios_integracoes")
        .select("access_token, dados_extras")
        .eq("user_id", cobranca.user_id)
        .eq("provedor", "asaas")
        .eq("status", "ativo")
        .order("is_default", { ascending: false })
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (integ?.access_token) {
        const env = (integ.dados_extras as any)?.environment === "production" ? "production" : "sandbox";
        const baseUrl = env === "production" ? "https://api.asaas.com" : "https://api-sandbox.asaas.com";

        const antRes = await fetch(`${baseUrl}/v3/anticipations?payment=${payment.id}&limit=10`, {
          headers: { access_token: integ.access_token },
        });

        if (antRes.ok) {
          const antData = await antRes.json();
          const list = Array.isArray(antData.data) ? antData.data : [];
          anticipation = list.find((a: any) => a.status === "CREDITED") || list[0] || null;
        } else {
          console.warn(`[syncAnticipation] Falha ao consultar antecipações Asaas: status ${antRes.status}`);
        }
      }
    }

    if (!anticipation) {
      console.log(`[syncAnticipation] Nenhuma antecipação encontrada para payment ${payment.id}`);
      return;
    }

    const antStatus = anticipation.status || "CREDITED";
    const antFee = Number(anticipation.fee) || 0;
    const antNetValue = Number(anticipation.netValue) || 0;
    const antCreditDate = antStatus === "CREDITED" 
      ? (anticipation.creditDate || payment.confirmedDate || new Date().toISOString())
      : null;

    // 1. Gravar em gateway_anticipations
    const { data: antRecord } = await adminClient
      .from("gateway_anticipations")
      .upsert({
        provider: "asaas",
        provider_anticipation_id: anticipation.id,
        cobranca_id: cobranca?.id || null,
        parcela_id: parcelaId,
        status: antStatus,
        fee: antFee,
        net_value: antNetValue,
        request_date: anticipation.anticipationDate || anticipation.requestDate || null,
        credit_date: antCreditDate,
        updated_at: new Date().toISOString(),
      }, { onConflict: "provider, provider_anticipation_id" })
      .select("id")
      .maybeSingle();

    const antId = antRecord?.id || null;

    // 2. Se creditada, atualizar parcela e ajustar datas dos movimentos
    if (antStatus === "CREDITED" && antCreditDate) {
      const { data: currentParcela } = await adminClient
        .from("cobranca_parcelas")
        .select("valor_bruto, valor_principal, taxa_processamento_real, taxa_gateway")
        .eq("id", parcelaId)
        .maybeSingle();

      const procFee = Number(currentParcela?.taxa_processamento_real ?? currentParcela?.taxa_gateway ?? 0);
      const bruto = Number(currentParcela?.valor_principal ?? currentParcela?.valor_bruto ?? payment.value ?? 0);
      const finalNetValue = antNetValue > 0 ? antNetValue : Math.max(0, bruto - procFee - antFee);

      await adminClient
        .from("cobranca_parcelas")
        .update({
          antecipado: true,
          status: "antecipado",
          taxa_antecipacao: antFee,
          taxa_antecipacao_real: antFee,
          valor_liquido_creditado: finalNetValue,
          data_credito_real: antCreditDate,
          updated_at: new Date().toISOString(),
        })
        .eq("id", parcelaId);

      // Atualizar data de crédito real na cobrança pai
      if (cobranca?.id) {
        await adminClient
          .from("cobrancas")
          .update({
            data_credito_real: antCreditDate,
            updated_at: new Date().toISOString(),
          })
          .eq("id", cobranca.id);
      }

      // Alinhar a data dos movimentos de crédito e repasse existentes para a data real de crédito
      await adminClient
        .from("gateway_cash_movements")
        .update({ movement_date: antCreditDate })
        .eq("parcela_id", parcelaId)
        .in("movement_type", ["credit", "pass_through"]);

      // Alinhar a taxa de processamento do gateway para a data real do crédito
      await adminClient
        .from("gateway_cash_movements")
        .update({ movement_date: antCreditDate })
        .eq("parcela_id", parcelaId)
        .eq("provider_transaction_id", `payment_${payment.id}_fee`);

      // 3. Upsert do movimento da taxa de antecipação
      if (antFee > 0) {
        await adminClient.from("gateway_cash_movements").upsert({
          provider: "asaas",
          provider_transaction_id: `anticipation_${anticipation.id}_fee`,
          cobranca_id: cobranca?.id || null,
          parcela_id: parcelaId,
          anticipation_id: antId,
          movement_type: "fee",
          amount: -antFee,
          movement_date: antCreditDate,
          due_date: null,
          competence_date: antCreditDate,
          description: `Taxa de antecipação ${anticipation.id}`,
        }, { onConflict: "provider, provider_transaction_id, movement_type" });
      }

      console.log(`✅ [syncAnticipation] Antecipação ${anticipation.id} liquidada: antFee=${antFee}, net=${finalNetValue}, data=${antCreditDate}`);
    }
  } catch (err) {
    console.error("[syncAnticipation] Erro ao sincronizar antecipação:", err);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // 🛡️ Validação de Segurança do Webhook Asaas (Header asaas-access-token)
    const asaasWebhookSecret = Deno.env.get("ASAAS_WEBHOOK_SECRET");
    const receivedToken = req.headers.get("asaas-access-token");
    if (asaasWebhookSecret && receivedToken && receivedToken !== asaasWebhookSecret) {
      console.warn("[asaas-webhook] Rejeitado: cabeçalho asaas-access-token inválido.");
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const event = body.event;
    const payment = body.payment;
    const subscription = body.subscription;

    console.log("Asaas webhook received:", event, JSON.stringify(body).slice(0, 500));

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Log webhook to webhook_logs
    await adminClient.from("webhook_logs").insert({
      provedor: "asaas",
      payload: body,
      headers: Object.fromEntries(req.headers.entries()),
    }).then(() => {}, (err: any) => console.error("Log insert error:", err));

    // ==========================================
    // PAYMENT EVENTS
    // ==========================================
    const PAYMENT_EVENTS = [
      "PAYMENT_CONFIRMED",
      "PAYMENT_RECEIVED",
      "PAYMENT_ANTICIPATED",
      "PAYMENT_REFUNDED",
      "PAYMENT_PARTIALLY_REFUNDED",
      "PAYMENT_CHARGEBACK_REQUESTED",
      "PAYMENT_CHARGEBACK_DISPUTE",
      "PAYMENT_DELETED",
    ];

    if (PAYMENT_EVENTS.includes(event) && payment) {
      if (payment.subscription) {
        // --- SUBSCRIPTION PAYMENTS ---
        if (event === "PAYMENT_CONFIRMED" || event === "PAYMENT_RECEIVED") {
          const { data: sub } = await adminClient
            .from("subscriptions_asaas")
            .select("*")
            .eq("asaas_subscription_id", payment.subscription)
            .single();

          const today = new Date();
          const cycleDays = sub?.billing_cycle === "YEARLY" ? 365 : 30;
          const nextPeriodEnd = new Date(today);
          nextPeriodEnd.setDate(nextPeriodEnd.getDate() + cycleDays);

          await adminClient
            .from("subscriptions_asaas")
            .update({
              status: "ACTIVE",
              next_due_date: nextPeriodEnd.toISOString().split("T")[0],
            })
            .eq("asaas_subscription_id", payment.subscription);

          console.log("Subscription activated:", payment.subscription);

          if (sub?.pending_downgrade_plan) {
            await applyDowngrade(adminClient, sub);
          }
        }
      } else {
        // --- NON-SUBSCRIPTION PAYMENTS (gestão/checkout charges) ---

        // Idempotency check
        const alreadyProcessed = await checkAndLogEvent(
          adminClient,
          event,
          body.id || `${event}_${payment.id}`,
          body
        );
        if (alreadyProcessed) {
          return new Response(JSON.stringify({ received: true, skipped: true }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Find parent cobranca
        const cobranca = await findCobranca(adminClient, payment);

        if (!cobranca) {
          console.log(`ℹ️ No cobrança found for payment ${payment.id} (installment=${payment.installment})`);
        } else {
          let upsertSuccess = false;

          if (event === "PAYMENT_CONFIRMED") {
            upsertSuccess = await upsertParcela(adminClient, cobranca.id, payment, "confirmado", cobranca);
          } else if (event === "PAYMENT_RECEIVED") {
            upsertSuccess = await upsertParcela(adminClient, cobranca.id, payment, "recebido", cobranca);
          } else if (event === "PAYMENT_ANTICIPATED") {
            upsertSuccess = await upsertParcela(adminClient, cobranca.id, payment, "antecipado", cobranca);
          } else if (event === "PAYMENT_REFUNDED" || event === "PAYMENT_PARTIALLY_REFUNDED" || event === "PAYMENT_CHARGEBACK_REQUESTED" || event === "PAYMENT_CHARGEBACK_DISPUTE") {
            upsertSuccess = await upsertParcela(adminClient, cobranca.id, payment, "estornado", cobranca);
          } else if (event === "PAYMENT_DELETED") {
            upsertSuccess = await upsertParcela(adminClient, cobranca.id, payment, "cancelado", cobranca);
          }

          if (upsertSuccess && payment.id) {
            await markEventProcessed(adminClient, body.id || `${event}_${payment.id}`);

            // Atualização de Metadados na Cobrança (data_credito e data_credito_real)
            // OBS: Status e valor_liquido são consolidados pelo trigger reconcile_cobranca_from_parcelas!
            const cobrancaMetaUpdate: Record<string, any> = {
              updated_at: new Date().toISOString(),
            };
            if (payment.creditDate || payment.estimatedCreditDate) {
              cobrancaMetaUpdate.data_credito = payment.creditDate || payment.estimatedCreditDate;
            }
            if (event === "PAYMENT_RECEIVED" || event === "PAYMENT_ANTICIPATED") {
              cobrancaMetaUpdate.data_credito_real = new Date().toISOString();
            }
            await adminClient.from("cobrancas").update(cobrancaMetaUpdate).eq("id", cobranca.id);

            // Gravação do Razão de Caixa do Gateway (gateway_cash_movements)
            if (event === "PAYMENT_RECEIVED" || event === "PAYMENT_CONFIRMED" || event === "PAYMENT_ANTICIPATED") {
              const totalParcelas = cobranca.total_parcelas && cobranca.total_parcelas > 0 ? cobranca.total_parcelas : 1;
              const valorPrincipalCob = Number(
                cobranca.valor_principal ?? 
                cobranca.dados_extras?.valorBase ?? 
                cobranca.valor ?? 
                payment.value ?? 
                0
              );
              const valorCobradoCob = Number(
                payment.value ?? 
                cobranca.valor_cobrado_cliente ?? 
                cobranca.dados_extras?.valorComTaxas ?? 
                valorPrincipalCob
              );

              const valorPrincipalParcela = Math.round((valorPrincipalCob / totalParcelas) * 100) / 100;
              const valorCobradoParcela = Math.round((valorCobradoCob / totalParcelas) * 100) / 100;
              const valorRepassadoParcela = Math.max(0, Math.round((valorCobradoParcela - valorPrincipalParcela) * 100) / 100);

              const valorBrutoTransacionado = payment.value != null ? Number(payment.value) : valorCobradoParcela;
              const valorLiquidoAsaas = payment.netValue != null ? Number(payment.netValue) : valorBrutoTransacionado;
              const taxaGatewayReal = Math.max(0, Math.round((valorBrutoTransacionado - valorLiquidoAsaas) * 100) / 100);

              const { data: pData } = await adminClient
                .from("cobranca_parcelas")
                .select("id")
                .eq("asaas_payment_id", payment.id)
                .maybeSingle();

              const movementDate = payment.creditDate || payment.paymentDate || payment.confirmedDate || new Date().toISOString();
              const dueDate = payment.dueDate || null;
              const competenceDate = payment.paymentDate || payment.confirmedDate || null;

              // 1. Linha de Receita de Serviço (Valor Principal)
              await adminClient.from("gateway_cash_movements").upsert({
                provider: "asaas",
                provider_transaction_id: `payment_${payment.id}_credit`,
                cobranca_id: cobranca.id,
                parcela_id: pData?.id || null,
                movement_type: "credit",
                amount: valorPrincipalParcela,
                movement_date: movementDate,
                due_date: dueDate,
                competence_date: competenceDate,
                description: `Crédito de serviço ${payment.id}`,
              }, { onConflict: "provider, provider_transaction_id, movement_type" });

              // 2. Linha de Repasse de Taxa Cobrado do Cliente (se houver gross-up)
              if (valorRepassadoParcela > 0) {
                await adminClient.from("gateway_cash_movements").upsert({
                  provider: "asaas",
                  provider_transaction_id: `payment_${payment.id}_pass_through`,
                  cobranca_id: cobranca.id,
                  parcela_id: pData?.id || null,
                  movement_type: "pass_through",
                  amount: valorRepassadoParcela,
                  movement_date: movementDate,
                  due_date: dueDate,
                  competence_date: competenceDate,
                  description: `Repasse de taxa cobrado do cliente ${payment.id}`,
                }, { onConflict: "provider, provider_transaction_id, movement_type" });
              }

              // 3. Linha de Taxa de Processamento do Gateway
              if (taxaGatewayReal > 0) {
                await adminClient.from("gateway_cash_movements").upsert({
                  provider: "asaas",
                  provider_transaction_id: `payment_${payment.id}_fee`,
                  cobranca_id: cobranca.id,
                  parcela_id: pData?.id || null,
                  movement_type: "fee",
                  amount: -taxaGatewayReal,
                  movement_date: movementDate,
                  due_date: dueDate,
                  competence_date: competenceDate,
                  description: `Taxa de processamento ${payment.id}`,
                }, { onConflict: "provider, provider_transaction_id, movement_type" });
              }

              // Sincronização e liquidação automática da antecipação se aplicável
              if (event === "PAYMENT_ANTICIPATED" || payment.anticipated === true) {
                if (pData?.id) {
                  await syncAnticipationForPayment(adminClient, cobranca, payment, pData.id);
                }
              }
            }

            // Disparo de finalização de extras se aplicável
            if (cobranca.galeria_id || cobranca.finalidade === "fotos_extras" || cobranca.finalidade === "sessao_e_extras") {
              try {
                await adminClient.rpc("finalize_gallery_payment", {
                  p_cobranca_id: cobranca.id,
                  p_paid_at: new Date().toISOString(),
                });
                console.log(`[asaas-webhook] finalize_gallery_payment executado para cobranca=${cobranca.id}`);
              } catch (finalizeErr) {
                console.warn("[asaas-webhook] finalize_gallery_payment erro não impeditivo:", finalizeErr);
              }
            }

            // Disparo de e-mail assíncrono
            try {
              const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
              const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
              fetch(`${supabaseUrl}/functions/v1/send-email`, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${serviceRoleKey}`,
                },
                body: JSON.stringify({
                  eventType: "payment_confirmed",
                  paymentId: cobranca.id,
                  galleryId: cobranca.galeria_id || undefined,
                }),
              }).catch((e) => console.warn("[asaas-webhook] send-email async error:", e));
            } catch (e) {
              console.warn("[asaas-webhook] send-email error:", e);
            }

            // CRM Enrich
            if ((event === "PAYMENT_CONFIRMED" || event === "PAYMENT_RECEIVED") && payment.customer && cobranca.user_id) {
              await enrichClienteFromAsaasPayment(
                adminClient,
                cobranca.id,
                payment.customer,
                cobranca.user_id,
              );
            }
          }

          if (!upsertSuccess) {
            console.error(
              `❌ Webhook ${event} não persistiu parcela | cobranca=${cobranca.id} payment=${payment.id}`,
            );
            return new Response(
              JSON.stringify({
                received: false,
                error: "parcela_upsert_failed",
                cobrancaId: cobranca.id,
                paymentId: payment.id,
                event,
              }),
              { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
            );
          }
        }
      }
    }

    // ==========================================
    // ANTICIPATION EVENTS (RECEIVABLE_ANTICIPATION_*)
    // ==========================================
    const ANTICIPATION_EVENTS = [
      "RECEIVABLE_ANTICIPATION_PENDING",
      "RECEIVABLE_ANTICIPATION_SCHEDULED",
      "RECEIVABLE_ANTICIPATION_AUTHORIZED",
      "RECEIVABLE_ANTICIPATION_CREDITED",
      "RECEIVABLE_ANTICIPATION_DENIED",
      "RECEIVABLE_ANTICIPATION_CANCELLED",
      "RECEIVABLE_ANTICIPATION_DEBITED",
      "RECEIVABLE_ANTICIPATION_OVERDUE",
    ];

    if (ANTICIPATION_EVENTS.includes(event) && body.anticipation) {
      const anticipation = body.anticipation;
      
      const alreadyProcessed = await checkAndLogEvent(
        adminClient,
        event,
        body.id || `${event}_${anticipation.id}`,
        body
      );
      if (alreadyProcessed) {
        return new Response(JSON.stringify({ received: true, skipped: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const cobranca = anticipation.payment ? await findCobranca(adminClient, { id: anticipation.payment }) : null;
      let parcelaId = null;

      if (cobranca && anticipation.payment) {
        const { data: pData } = await adminClient
          .from("cobranca_parcelas")
          .select("id")
          .eq("asaas_payment_id", anticipation.payment)
          .maybeSingle();
        parcelaId = pData?.id || null;
      }

      if (parcelaId) {
        await syncAnticipationForPayment(
          adminClient,
          cobranca,
          { id: anticipation.payment },
          parcelaId,
          anticipation
        );
      }

      await markEventProcessed(adminClient, body.id || `${event}_${anticipation.id}`);
    }

    // ==========================================
    // PAYMENT_OVERDUE (subscription only)
    // ==========================================
    if (event === "PAYMENT_OVERDUE") {
      if (payment?.subscription) {
        await adminClient
          .from("subscriptions_asaas")
          .update({ status: "OVERDUE" })
          .eq("asaas_subscription_id", payment.subscription);
        console.log("Subscription overdue:", payment.subscription);
      }
    }

    // ==========================================
    // SUBSCRIPTION EVENTS
    // ==========================================
    if (event === "SUBSCRIPTION_DELETED" || event === "SUBSCRIPTION_INACTIVATED") {
      const subId = subscription?.id || body.id;
      if (subId) {
        const { data: sub } = await adminClient
          .from("subscriptions_asaas")
          .select("*")
          .eq("asaas_subscription_id", subId)
          .single();

        await adminClient
          .from("subscriptions_asaas")
          .update({ status: "CANCELLED" })
          .eq("asaas_subscription_id", subId);

        console.log("Subscription cancelled:", subId);

        if (sub) {
          const subCredits = PLAN_SUBSCRIPTION_CREDITS[sub.plan_type];
          if (subCredits && subCredits > 0) {
            const { error: expireError } = await adminClient.rpc("expire_subscription_credits", {
              _user_id: sub.user_id,
            });
            if (expireError) {
              console.error("Failed to expire subscription credits:", expireError);
            } else {
              console.log(`Expired subscription credits for user ${sub.user_id}`);
            }
          }
        }
      }
    }

    if (event === "SUBSCRIPTION_RENEWED") {
      const subId = subscription?.id || body.id;
      if (subId) {
        const alreadyProcessed = await checkAndLogEvent(
          adminClient,
          event,
          body.id || `sub_renew_${subId}_${new Date().toISOString().slice(0, 10)}`,
          body
        );

        if (!alreadyProcessed) {
          const { data: sub } = await adminClient
            .from("subscriptions_asaas")
            .select("*")
            .eq("asaas_subscription_id", subId)
            .single();

          const cycleDays = sub?.billing_cycle === "YEARLY" ? 365 : 30;
          const nextPeriodEnd = new Date();
          nextPeriodEnd.setDate(nextPeriodEnd.getDate() + cycleDays);

          await adminClient
            .from("subscriptions_asaas")
            .update({
              status: "ACTIVE",
              next_due_date: nextPeriodEnd.toISOString().split("T")[0],
            })
            .eq("asaas_subscription_id", subId);

          console.log("Subscription renewed:", subId);

          if (sub) {
            const subCredits = PLAN_SUBSCRIPTION_CREDITS[sub.plan_type];
            if (subCredits && subCredits > 0) {
              const { error: creditError } = await adminClient.rpc("renew_subscription_credits", {
                _user_id: sub.user_id,
                _amount: subCredits,
              });
              if (creditError) {
                console.error("Failed to renew subscription credits:", creditError);
              } else {
                console.log(`Renewed ${subCredits} subscription credits for user ${sub.user_id}`);
              }
            }

            if (sub.pending_downgrade_plan) {
              await applyDowngrade(adminClient, sub);
            }
          }

          await markEventProcessed(adminClient, body.id || `sub_renew_${subId}_${new Date().toISOString().slice(0, 10)}`);
        }
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Webhook error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
