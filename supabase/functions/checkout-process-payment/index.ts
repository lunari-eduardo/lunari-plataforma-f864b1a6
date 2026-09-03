// supabase/functions/checkout-process-payment/index.ts
// Terminal público de checkout transparente do Asaas, validando formulário do cliente,
// enriquecendo CRM e delegando a execução ao adaptador create-asaas-payment.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.2";
import { corsHeaders, jsonResponse, errorResponse } from "../_shared/auth-guard.ts";
import { AdapterCreatePaymentInput, AdapterCreatePaymentOutput, ClienteContact } from "../_shared/payment-types.ts";
import { normalizeAsaasFees, calculateCreditFees } from "../_shared/asaas-helpers.ts";
import { createAsaasPayment } from "../_shared/adapters/asaas.ts";
import { createMercadoPagoPayment } from "../_shared/adapters/mercadopago.ts";
import { resolvePayerHints } from "../_shared/payer-hints.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const PUBLIC_SITE_URL = Deno.env.get("PUBLIC_SITE_URL") || "https://app.lunarihub.com";

interface PayerContact {
  name?: string;
  email?: string;
  phone?: string;
  cpfCnpj?: string;
}

interface RequestBody {
  cobrancaId: string;
  billingType: "PIX" | "CREDIT_CARD";
  installmentCount?: number;
  payerContact?: PayerContact;
  creditCard?: {
    holderName: string;
    number: string;
    expiryMonth: string;
    expiryYear: string;
    ccv: string;
  };
  cardToken?: string;
  paymentMethodId?: string;
  creditCardHolderInfo?: {
    name: string;
    cpfCnpj: string;
    email: string;
    phone: string;
    postalCode: string;
    addressNumber: string;
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const body: RequestBody = await req.json();
    const { cobrancaId, billingType, installmentCount, creditCard, creditCardHolderInfo, payerContact, cardToken, paymentMethodId } = body;

    if (!cobrancaId || !billingType) {
      return errorResponse("cobrancaId e billingType são obrigatórios", 400);
    }

    // 1. Buscar cobrança
    const { data: cobranca, error: cobrancaError } = await supabase
      .from("cobrancas")
      .select("id, user_id, cliente_id, session_id, galeria_id, finalidade, valor, descricao, status, provedor, dados_extras")
      .eq("id", cobrancaId)
      .maybeSingle();

    if (cobrancaError || !cobranca) {
      return errorResponse("Cobrança não encontrada", 404);
    }

    if (cobranca.status !== "pendente") {
      return jsonResponse({
        success: false,
        error: cobranca.status === "pago" ? "Esta cobrança já foi paga" : "Cobrança não disponível para pagamento",
        code: "INVALID_STATUS",
      }, 400);
    }

    // 2. Enriquecimento de contato do cliente no CRM
    const effectiveClienteId = cobranca.cliente_id || (
      await resolvePayerHints({
        supabase,
        galleryId: cobranca.galeria_id || null,
        sessionId: cobranca.session_id || null,
      })
    )?.cpfCnpj ? cobranca.cliente_id : cobranca.cliente_id;

    const { data: cliente } = effectiveClienteId ? await supabase
      .from("clientes")
      .select("id, nome, email, telefone, whatsapp, cpf_cnpj, cep, endereco, endereco_numero, endereco_complemento, bairro, cidade, uf")
      .eq("id", effectiveClienteId)
      .maybeSingle() : { data: null };

    const targetClienteId = cliente?.id || cobranca.cliente_id;
    if (targetClienteId) {
      const patch: Record<string, string> = {};
      const isEmpty = (v: unknown) => v == null || (typeof v === "string" && v.trim() === "");

      // Dados do titular do cartão (nome, CPF) NUNCA devem alterar o perfil do cliente no CRM
      // pois o pagador pode estar usando cartão de terceiros (cônjuge, pais, empresa).
      const candidateName = billingType === "CREDIT_CARD" ? undefined : payerContact?.name?.trim();
      const candidateCpf = billingType === "CREDIT_CARD" ? undefined : payerContact?.cpfCnpj?.trim();
      const candidateEmail = payerContact?.email?.trim();
      const candidatePhone = payerContact?.phone?.trim();

      if (candidateName && isEmpty(cliente?.nome)) patch.nome = candidateName;
      if (candidateEmail && isEmpty(cliente?.email)) patch.email = candidateEmail.toLowerCase();
      if (candidatePhone && isEmpty(cliente?.whatsapp) && isEmpty(cliente?.telefone)) {
        const phoneDigits = candidatePhone.replace(/\D/g, "");
        patch.whatsapp = phoneDigits;
        patch.telefone = phoneDigits;
      }
      if (candidateCpf && isEmpty(cliente?.cpf_cnpj)) {
        patch.cpf_cnpj = candidateCpf.replace(/\D/g, "");
      }

      if (Object.keys(patch).length > 0) {
        await supabase.from("clientes").update(patch).eq("id", targetClienteId);
        console.log(`[checkout-process-payment] CRM enriquecido para cliente=${targetClienteId}:`, Object.keys(patch));
      }
    }
    
    // Resolve dicas de contato, caso a requisição não traga os dados ou falte algo
    const resolvedHints = await resolvePayerHints({
      supabase,
      clienteId: cobranca.cliente_id || null,
      galleryId: cobranca.galeria_id || null,
      sessionId: cobranca.session_id || null,
    });

    const mergedCliente: ClienteContact = {
      id: cobranca.cliente_id || undefined,
      nome: cliente?.nome || (billingType !== "CREDIT_CARD" ? payerContact?.name : undefined) || resolvedHints.name || "Cliente",
      email: payerContact?.email || cliente?.email || resolvedHints.email || creditCardHolderInfo?.email,
      telefone: payerContact?.phone || cliente?.whatsapp || cliente?.telefone || resolvedHints.phone || creditCardHolderInfo?.phone,
      whatsapp: payerContact?.phone || cliente?.whatsapp || cliente?.telefone || resolvedHints.phone || creditCardHolderInfo?.phone,
      cpfCnpj: (billingType !== "CREDIT_CARD" ? payerContact?.cpfCnpj : undefined) || cliente?.cpf_cnpj || resolvedHints.cpfCnpj || creditCardHolderInfo?.cpfCnpj,
      cep: cliente?.cep || resolvedHints.postalCode || creditCardHolderInfo?.postalCode,
      endereco: cliente?.endereco || resolvedHints.address,
      numero: cliente?.endereco_numero || resolvedHints.addressNumber || creditCardHolderInfo?.addressNumber,
      complemento: cliente?.endereco_complemento || resolvedHints.complement,
      bairro: cliente?.bairro || resolvedHints.province,
      cidade: cliente?.cidade || resolvedHints.cityName,
      uf: cliente?.uf || resolvedHints.state,
    };

    // 3. Resolução de taxas e processamento por provedor
    let adapterData: AdapterCreatePaymentOutput;
    let finalValue = Number(cobranca.valor);
    let finalInstallments = billingType === "CREDIT_CARD" ? Math.max(1, installmentCount || 1) : 1;
    let taxaProcessamento = 0;
    let taxaAntecipacao = 0;
    let repassarTaxas = false;
    let repassarAntecipacao = false;
    let ireiAntecipar = false;
    const baseValue = Number(cobranca.valor);

    const adapterPayload: AdapterCreatePaymentInput = {
      cobrancaId: cobranca.id,
      userId: cobranca.user_id,
      valor: finalValue,
      descricao: cobranca.descricao || "Serviço fotográfico",
      cliente: mergedCliente,
      integrationData: {},
      billingType,
      creditCard,
      cardToken,
      paymentMethodId,
      creditCardHolderInfo,
      installmentCount: finalInstallments,
      requestDadosExtras: { paymentMethodId },
    };

    if (cobranca.provedor === 'mercadopago') {
      const { data: integracao } = await supabase
        .from("usuarios_integracoes")
        .select("dados_extras")
        .eq("user_id", cobranca.user_id)
        .eq("provedor", "mercadopago")
        .eq("status", "ativo")
        .maybeSingle();

      const rawExtras = (integracao?.dados_extras || {}) as Record<string, any>;
      const mpSettings = {
        ...((rawExtras.gestao_settings as Record<string, any>) || {}),
        ...((rawExtras.gallery_settings as Record<string, any>) || {}),
        ...rawExtras,
      };

      const chargeOverrides = (cobranca.dados_extras || {}) as {
        repassarTaxasProcessamento?: boolean;
        absorverTaxa?: boolean;
      };

      const absorverTaxa = chargeOverrides.absorverTaxa !== undefined
        ? Boolean(chargeOverrides.absorverTaxa)
        : (chargeOverrides.repassarTaxasProcessamento !== undefined
          ? !chargeOverrides.repassarTaxasProcessamento
          : (mpSettings.absorverTaxa !== false));

      repassarTaxas = !absorverTaxa;

      if (billingType === "CREDIT_CARD" && repassarTaxas) {
        const mpFees = [
          { min: 1, max: 1, percentageFee: 4.98 },
          { min: 2, max: 2, percentageFee: 7.90 },
          { min: 3, max: 3, percentageFee: 9.20 },
          { min: 4, max: 4, percentageFee: 10.50 },
          { min: 5, max: 5, percentageFee: 11.80 },
          { min: 6, max: 6, percentageFee: 13.10 },
          { min: 7, max: 7, percentageFee: 14.50 },
          { min: 8, max: 8, percentageFee: 15.80 },
          { min: 9, max: 9, percentageFee: 17.10 },
          { min: 10, max: 10, percentageFee: 18.40 },
          { min: 11, max: 11, percentageFee: 19.70 },
          { min: 12, max: 12, percentageFee: 21.00 },
        ];
        const tier = mpFees.find(t => finalInstallments >= t.min && finalInstallments <= t.max) || mpFees[mpFees.length - 1];
        const percentage = tier?.percentageFee ?? 0;
        taxaProcessamento = Math.round((baseValue * percentage / 100) * 100) / 100;
        finalValue = Math.round((baseValue + taxaProcessamento) * 100) / 100;
      }

      adapterPayload.valor = finalValue;
      adapterData = await createMercadoPagoPayment(supabase, adapterPayload, SUPABASE_URL, PUBLIC_SITE_URL);
      if (!adapterData.success) {
        console.error("[checkout-process-payment] Adaptador MercadoPago retornou erro:", adapterData);
        return jsonResponse({
          success: false,
          error: adapterData.error || "Erro ao processar pagamento",
          code: adapterData.errorCode || "MP_ERROR",
        }, 400);
      }
    } else {
      // Logic original do Asaas
      const { data: integracao } = await supabase
        .from("usuarios_integracoes")
        .select("access_token, dados_extras")
        .eq("user_id", cobranca.user_id)
        .eq("provedor", "asaas")
        .eq("status", "ativo")
        .order("is_default", { ascending: false })
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const rawExtras = (integracao?.dados_extras || {}) as Record<string, any>;
      const globalSettings = {
        ...((rawExtras.gestao_settings as Record<string, any>) || {}),
        ...((rawExtras.gallery_settings as Record<string, any>) || {}),
        ...rawExtras,
      };

      const asaasBaseUrl = globalSettings.environment === "production"
        ? "https://api.asaas.com"
        : "https://api-sandbox.asaas.com";

      const chargeOverrides = (cobranca.dados_extras || {}) as {
        repassarTaxasProcessamento?: boolean;
        anteciparParcelas?: boolean;
        repassarTaxaAntecipacao?: boolean;
      };

      const legacyAntecipar = globalSettings.incluirTaxaAntecipacao === true;
      const globalAbsorverTaxa = globalSettings.absorverTaxa === true;
      const globalIreiAntecipar = globalSettings.ireiAntecipar ?? legacyAntecipar;
      const globalRepassarAntecipacao = globalIreiAntecipar ? (globalSettings.repassarTaxaAntecipacao ?? legacyAntecipar) : false;

      repassarTaxas = chargeOverrides.repassarTaxasProcessamento !== undefined
        ? chargeOverrides.repassarTaxasProcessamento
        : !globalAbsorverTaxa;
      ireiAntecipar = chargeOverrides.anteciparParcelas !== undefined
        ? chargeOverrides.anteciparParcelas
        : globalIreiAntecipar;
      repassarAntecipacao = ireiAntecipar
        ? (chargeOverrides.repassarTaxaAntecipacao !== undefined ? chargeOverrides.repassarTaxaAntecipacao : globalRepassarAntecipacao)
        : false;

      if (billingType === "CREDIT_CARD") {
        if ((repassarTaxas || repassarAntecipacao) && integracao?.access_token) {
          let normalizedFees = normalizeAsaasFees(null);
          try {
            const feesResp = await fetch(`${asaasBaseUrl}/v3/myAccount/fees`, {
              headers: { access_token: integracao.access_token },
            });
            if (feesResp.ok) {
              const rawFees = await feesResp.json();
              normalizedFees = normalizeAsaasFees(rawFees);
            } else {
              console.warn(`[checkout-process-payment] Failed to fetch Asaas fees, status: ${feesResp.status}`);
            }
          } catch (feeErr) {
            console.warn(`[checkout-process-payment] Error fetching Asaas fees:`, feeErr);
          }

          const calc = calculateCreditFees(
            baseValue,
            finalInstallments,
            normalizedFees,
            repassarTaxas,
            repassarAntecipacao
          );

          finalValue = calc.totalValue;
          taxaProcessamento = calc.processingFee;
          taxaAntecipacao = calc.anticipationFee;
        }
      }

      adapterPayload.valor = finalValue;

      adapterData = await createAsaasPayment(supabase, adapterPayload, PUBLIC_SITE_URL);
      if (!adapterData.success) {
        console.error("[checkout-process-payment] Adaptador Asaas retornou erro:", adapterData);
        return jsonResponse({
          success: false,
          error: adapterData.error || "Erro ao processar pagamento",
          code: adapterData.errorCode || "ASAAS_ERROR",
        }, 400);
      }
    }

    // 5. Atualizar registro da cobrança com IDs e breakdown de taxas
    let existingExtras = cobranca.dados_extras || {};
    if (typeof existingExtras === 'string') {
      try { existingExtras = JSON.parse(existingExtras); } catch(e) {}
    }

    const updatePayload: Record<string, any> = {
      provider_order_id: adapterData.providerOrderId || null,
      checkout_url: adapterData.checkoutUrl || null,
      pix_copia_cola: adapterData.pixCopiaCola || null,
      pix_qr_code_base64: adapterData.pixQrCodeBase64 || null,
      mp_pix_copia_cola: adapterData.pixCopiaCola || null, // Retrocompatibilidade
      // Decomposição financeira: base do serviço vs. total cobrado do cliente (com gross-up de taxas)
      valor_principal: baseValue,              // ex: 90,00 — receita nominal do serviço
      valor_cobrado_cliente: finalValue,       // ex: 96,20 — total pago pelo cliente c/ repasse
      dados_extras: {
        ...existingExtras,
        ...(adapterData.dadosExtras || {}),
        valorBase: baseValue,
        valorComTaxas: finalValue,
        taxaProcessamento: Math.round(taxaProcessamento * 100) / 100,
        taxaAntecipacao: Math.round(taxaAntecipacao * 100) / 100,
        repassarTaxasProcessamento: repassarTaxas,
        repassarTaxaAntecipacao: repassarAntecipacao,
        anteciparParcelas: ireiAntecipar,
        totalParcelas: finalInstallments,
      },
      updated_at: new Date().toISOString(),
    };

    const gatewayStatus = adapterData.dadosExtras?.status;
    const isPaid = gatewayStatus === "CONFIRMED" || gatewayStatus === "RECEIVED" || gatewayStatus === "approved";

    if (billingType === "PIX") {
      updatePayload.tipo_cobranca = "pix";
    } else if (billingType === "CREDIT_CARD") {
      updatePayload.tipo_cobranca = "card";
      if (finalInstallments) updatePayload.total_parcelas = finalInstallments;
    }


    if (isPaid) {
      updatePayload.status = "pago";
      updatePayload.data_pagamento = new Date().toISOString();

      if (repassarTaxas && repassarAntecipacao) {
        // Todas as taxas foram repassadas ao cliente -> fotógrafo recebe o valor integral nominal
        updatePayload.valor_liquido = cobranca.valor;
      } else if (repassarTaxas) {
        // Taxas de processamento repassadas, fotógrafo absorve apenas antecipação (se houver)
        updatePayload.valor_liquido = Math.max(0, Math.round((cobranca.valor - (taxaAntecipacao || 0)) * 100) / 100);
      } else {
        // Fotógrafo absorveu taxas de processamento
        if (finalInstallments && finalInstallments > 1 && adapterData.dadosExtras?.netValue != null && cobranca.provedor === 'asaas') {
          // Asaas retorna netValue de UMA parcela -> líquido total é a soma das parcelas
          updatePayload.valor_liquido = Math.round(adapterData.dadosExtras.netValue * finalInstallments * 100) / 100;
        } else if (adapterData.dadosExtras?.netValue != null) {
          // Mercado Pago retorna netValue total diretamente
          updatePayload.valor_liquido = adapterData.dadosExtras.netValue;
        } else {
          updatePayload.valor_liquido = Math.max(0, Math.round((cobranca.valor - (taxaProcessamento || 0) - (taxaAntecipacao || 0)) * 100) / 100);
        }
      }
    }

    const { error: updateError } = await supabase.from("cobrancas").update(updatePayload).eq("id", cobranca.id);
    
    if (updateError) {
      console.error(`[checkout-process-payment] Erro crítico ao atualizar a cobrança ${cobranca.id} no banco de dados:`, updateError);
      return errorResponse("Erro interno ao consolidar pagamento", 500, "UPDATE_COBRANCA_FAILED", updateError);
    }

    // Registrar parcela em cobranca_parcelas se houver providerOrderId
    if (adapterData.providerOrderId) {
      const numParcelas = finalInstallments || 1;
      const valorBrutoParcela = Math.round((cobranca.valor / numParcelas) * 100) / 100;
      const valorLiqParcela = adapterData.dadosExtras?.netValue != null
        ? adapterData.dadosExtras.netValue
        : Math.round((updatePayload.valor_liquido / numParcelas) * 100) / 100;

      const { data: pData } = await supabase.from("cobranca_parcelas").upsert({
        cobranca_id: cobranca.id,
        numero_parcela: 1,
        asaas_payment_id: adapterData.providerOrderId,
        valor_bruto: valorBrutoParcela,
        taxa_gateway: repassarTaxas ? 0 : Math.max(0, Math.round((valorBrutoParcela - valorLiqParcela) * 100) / 100),
        taxa_antecipacao: repassarAntecipacao ? 0 : Math.round((taxaAntecipacao / numParcelas) * 100) / 100,
        valor_liquido: valorLiqParcela,
        status: isPaid ? "confirmado" : "pendente",
        billing_type: billingType,
        data_vencimento: new Date().toISOString().split("T")[0],
        data_pagamento: isPaid ? updatePayload.data_pagamento : null,
        updated_at: new Date().toISOString(),
      }, { onConflict: "cobranca_id, numero_parcela" }).select("id").maybeSingle();

      if (isPaid && cobranca.provedor === "asaas") {
        const taxaGatewayVal = repassarTaxas ? 0 : Math.max(0, Math.round((valorBrutoParcela - valorLiqParcela) * 100) / 100);
        await supabase.from("gateway_cash_movements").upsert({
          provider: "asaas",
          provider_transaction_id: `payment_${adapterData.providerOrderId}_credit`,
          cobranca_id: cobranca.id,
          parcela_id: pData?.id || null,
          movement_type: "credit",
          amount: valorBrutoParcela,
          movement_date: updatePayload.data_pagamento || new Date().toISOString(),
          description: `Crédito de pagamento ${adapterData.providerOrderId}`,
        }, { onConflict: "provider, provider_transaction_id, movement_type" });

        if (taxaGatewayVal > 0) {
          await supabase.from("gateway_cash_movements").upsert({
            provider: "asaas",
            provider_transaction_id: `payment_${adapterData.providerOrderId}_fee`,
            cobranca_id: cobranca.id,
            parcela_id: pData?.id || null,
            movement_type: "fee",
            amount: -taxaGatewayVal,
            movement_date: updatePayload.data_pagamento || new Date().toISOString(),
            description: `Taxa de processamento ${adapterData.providerOrderId}`,
          }, { onConflict: "provider, provider_transaction_id, movement_type" });
        }
      }
    }

    if (isPaid && (cobranca.galeria_id || cobranca.finalidade === "fotos_extras" || cobranca.finalidade === "sessao_e_extras")) {
      try {
        await supabase.rpc("finalize_gallery_payment", {
          p_cobranca_id: cobranca.id,
          p_paid_at: updatePayload.data_pagamento,
        });
        console.log(`[checkout-process-payment] finalize_gallery_payment executado para cobranca=${cobranca.id}`);
      } catch (finalizeErr) {
        console.error("[checkout-process-payment] Falha não fatal ao invocar finalize_gallery_payment:", finalizeErr);
      }
    }

    console.log(`[checkout-process-payment] Cobrança ${cobranca.id} processada com sucesso (status=${updatePayload.status || 'pendente'})!`);

    return jsonResponse({
      success: true,
      paymentId: adapterData.providerOrderId,
      cobrancaId: cobranca.id,
      pixCopiaCola: adapterData.pixCopiaCola,
      pixCopiaECola: adapterData.pixCopiaCola,
      pixQrCode: adapterData.pixQrCodeBase64,
      pixQrCodeBase64: adapterData.pixQrCodeBase64,
      invoiceUrl: adapterData.checkoutUrl,
      billingType,
      status: gatewayStatus || (billingType === "PIX" ? "PENDING" : (isPaid ? "CONFIRMED" : "PENDING")),
      creditCardStatus: gatewayStatus || undefined,
      paid: isPaid,
    }, 200);
  } catch (err: any) {
    console.error("[checkout-process-payment] Exceção inesperada:", err);
    return errorResponse(err.message || "Erro interno ao processar checkout", 500);
  }
});
