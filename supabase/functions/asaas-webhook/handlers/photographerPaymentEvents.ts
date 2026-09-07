import { checkAndLogEvent, markEventProcessed } from "../types.ts";
import { enrichClienteFromAsaasPayment } from "../enrichment.ts";
import { getPhotographerAsaasConfig } from "../../_shared/user-asaas.ts";

export async function findCobranca(adminClient: any, payment: any) {
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

export function getStatusRank(status: string | null | undefined): number {
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

export async function upsertParcela(
  adminClient: any,
  cobrancaId: string,
  payment: any,
  status: string,
  cobranca?: any
) {
  const totalParcelas = cobranca?.total_parcelas && cobranca.total_parcelas > 0 ? cobranca.total_parcelas : 1;

  const valorPrincipalCob = Number(
    cobranca?.valor_principal ?? 
    cobranca?.dados_extras?.valorBase ?? 
    cobranca?.valor ?? 
    payment.value ?? 
    0
  );
  const valorCobradoCob = Number(
    payment.value ?? 
    cobranca?.valor_cobrado_cliente ?? 
    cobranca?.dados_extras?.valorComTaxas ?? 
    valorPrincipalCob
  );

  const valorPrincipalParcela = Math.round((valorPrincipalCob / totalParcelas) * 100) / 100;
  const valorCobradoParcela = Math.round((valorCobradoCob / totalParcelas) * 100) / 100;
  const valorRepassadoParcela = Math.max(0, Math.round((valorCobradoParcela - valorPrincipalParcela) * 100) / 100);

  const valorBrutoTransacionado = payment.value != null ? Number(payment.value) : valorCobradoParcela;
  let valorLiquidoAsaas = payment.netValue != null ? Number(payment.netValue) : valorBrutoTransacionado;

  let taxaGatewayReal = Math.max(0, Math.round((valorBrutoTransacionado - valorLiquidoAsaas) * 100) / 100);

  const { data: existingParcela } = await adminClient
    .from("cobranca_parcelas")
    .select("id, status, taxa_gateway, taxa_processamento_real, taxa_antecipacao, taxa_antecipacao_real, valor_liquido, valor_liquido_creditado, data_credito_real")
    .eq("asaas_payment_id", payment.id)
    .maybeSingle();

  if (taxaGatewayReal === 0 && Number(existingParcela?.taxa_processamento_real || existingParcela?.taxa_gateway || 0) > 0) {
    taxaGatewayReal = Number(existingParcela.taxa_processamento_real || existingParcela.taxa_gateway);
    valorLiquidoAsaas = Math.max(0, Math.round((valorBrutoTransacionado - taxaGatewayReal) * 100) / 100);
  }

  const currentRank = getStatusRank(existingParcela?.status);
  const newRank = getStatusRank(status);
  const finalStatus = currentRank > newRank ? existingParcela!.status : status;

  const existingAntFee = Number(existingParcela?.taxa_antecipacao_real ?? existingParcela?.taxa_antecipacao ?? 0);
  const existingCreditReal = existingParcela?.data_credito_real || (finalStatus === "recebido" ? (payment.creditDate || null) : null);
  
  const finalLiquidoCreditado = existingAntFee > 0
    ? Math.max(0, Math.round((valorLiquidoAsaas - existingAntFee) * 100) / 100)
    : valorLiquidoAsaas;

  const parcelaData: Record<string, unknown> = {
    cobranca_id: cobrancaId,
    numero_parcela: payment.installmentNumber || 1,
    asaas_payment_id: payment.id,
    valor_bruto: valorPrincipalParcela,
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

export async function syncAnticipationForPayment(
  adminClient: any,
  cobranca: any,
  payment: any,
  parcelaId: string,
  providedAnticipation?: any
) {
  try {
    let anticipation = providedAnticipation;

    if (!anticipation && cobranca?.user_id && payment?.id) {
      const asaasConfig = await getPhotographerAsaasConfig(adminClient, cobranca.user_id);

      if (asaasConfig) {
        const antRes = await fetch(`${asaasConfig.baseUrl}/v3/anticipations?payment=${payment.id}&limit=10`, {
          headers: { access_token: asaasConfig.apiKey },
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

      if (cobranca?.id) {
        await adminClient
          .from("cobrancas")
          .update({
            data_credito_real: antCreditDate,
            updated_at: new Date().toISOString(),
          })
          .eq("id", cobranca.id);
      }

      await adminClient
        .from("gateway_cash_movements")
        .update({ movement_date: antCreditDate })
        .eq("parcela_id", parcelaId)
        .in("movement_type", ["credit", "pass_through"]);

      await adminClient
        .from("gateway_cash_movements")
        .update({ movement_date: antCreditDate })
        .eq("parcela_id", parcelaId)
        .eq("provider_transaction_id", `payment_${payment.id}_fee`);

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

export async function handlePhotographerPayment(
  adminClient: any,
  body: any,
  payment: any,
  event: string
): Promise<{ success: boolean; error?: string; skipped?: boolean }> {
  const alreadyProcessed = await checkAndLogEvent(
    adminClient,
    event,
    body.id || `${event}_${payment.id}`,
    body
  );
  if (alreadyProcessed) {
    return { success: true, skipped: true };
  }

  const cobranca = await findCobranca(adminClient, payment);
  if (!cobranca) {
    console.log(`ℹ️ No cobrança found for payment ${payment.id} (installment=${payment.installment})`);
    return { success: true };
  }

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

      // 1. Linha de Receita de Serviço
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

      // 2. Linha de Repasse de Taxa Cobrado do Cliente
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

      if (event === "PAYMENT_ANTICIPATED" || payment.anticipated === true) {
        if (pData?.id) {
          await syncAnticipationForPayment(adminClient, cobranca, payment, pData.id);
        }
      }
    }

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
    return { success: false, error: "parcela_upsert_failed" };
  }

  return { success: true };
}

export async function handleAnticipationEvent(
  adminClient: any,
  body: any,
  event: string
): Promise<{ success: boolean; skipped?: boolean }> {
  const anticipation = body.anticipation;
  const alreadyProcessed = await checkAndLogEvent(
    adminClient,
    event,
    body.id || `${event}_${anticipation.id}`,
    body
  );
  if (alreadyProcessed) {
    return { success: true, skipped: true };
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
  return { success: true };
}
