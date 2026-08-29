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
      .select("id, nome, email, telefone, whatsapp, cpf_cnpj, cep, endereco, numero, complemento, bairro, cidade, estado")
      .eq("id", effectiveClienteId)
      .maybeSingle() : { data: null };

    const targetClienteId = cliente?.id || cobranca.cliente_id;
    if (targetClienteId) {
      const patch: Record<string, string> = {};
      const isEmpty = (v: unknown) => v == null || (typeof v === "string" && v.trim() === "");

      const candidateName = payerContact?.name?.trim() || creditCardHolderInfo?.name?.trim();
      const candidateEmail = payerContact?.email?.trim() || creditCardHolderInfo?.email?.trim();
      const candidatePhone = payerContact?.phone?.trim() || creditCardHolderInfo?.phone?.trim();
      const candidateCpf = payerContact?.cpfCnpj?.trim() || creditCardHolderInfo?.cpfCnpj?.trim();
      const candidateCep = creditCardHolderInfo?.postalCode?.trim();

      if (candidateName && isEmpty(cliente?.nome)) patch.nome = candidateName;
      if (candidateEmail && isEmpty(cliente?.email)) patch.email = candidateEmail.toLowerCase();
      if (candidatePhone && isEmpty(cliente?.whatsapp) && isEmpty(cliente?.telefone)) {
        patch.whatsapp = candidatePhone.replace(/\D/g, "");
      }
      if (candidateCpf && isEmpty(cliente?.cpf_cnpj)) {
        patch.cpf_cnpj = candidateCpf.replace(/\D/g, "");
      }
      if (candidateCep && isEmpty(cliente?.cep)) {
        patch.cep = candidateCep.replace(/\D/g, "");
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
      nome: payerContact?.name || cliente?.nome || resolvedHints.name || creditCard?.holderName || "Cliente",
      email: payerContact?.email || cliente?.email || resolvedHints.email || creditCardHolderInfo?.email,
      telefone: payerContact?.phone || cliente?.whatsapp || cliente?.telefone || resolvedHints.phone || creditCardHolderInfo?.phone,
      whatsapp: payerContact?.phone || cliente?.whatsapp || cliente?.telefone || resolvedHints.phone || creditCardHolderInfo?.phone,
      cpfCnpj: payerContact?.cpfCnpj || cliente?.cpf_cnpj || resolvedHints.cpfCnpj || creditCardHolderInfo?.cpfCnpj,
      cep: cliente?.cep || resolvedHints.postalCode || creditCardHolderInfo?.postalCode,
      endereco: cliente?.endereco,
      numero: cliente?.numero || creditCardHolderInfo?.addressNumber,
      complemento: cliente?.complemento,
      bairro: cliente?.bairro,
      cidade: cliente?.cidade,
      uf: cliente?.estado,
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
      creditCardHolderInfo,
      installmentCount: finalInstallments,
      requestDadosExtras: { paymentMethodId },
    };

    if (cobranca.provedor === 'mercadopago') {
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
    const updatePayload: Record<string, any> = {
      provider_order_id: adapterData.providerOrderId || null,
      checkout_url: adapterData.checkoutUrl || null,
      pix_copia_cola: adapterData.pixCopiaCola || null,
      pix_qr_code_base64: adapterData.pixQrCodeBase64 || null,
      mp_pix_copia_cola: adapterData.pixCopiaCola || null, // Retrocompatibilidade
      dados_extras: {
        ...(cobranca.dados_extras || {}),
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

    const asaasStatus = adapterData.dadosExtras?.status;
    const isPaid = asaasStatus === "CONFIRMED" || asaasStatus === "RECEIVED";

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
        if (finalInstallments && finalInstallments > 1 && adapterData.dadosExtras?.netValue != null) {
          // Asaas retorna netValue de UMA parcela -> líquido total é a soma das parcelas
          updatePayload.valor_liquido = Math.round(adapterData.dadosExtras.netValue * finalInstallments * 100) / 100;
        } else if (adapterData.dadosExtras?.netValue != null) {
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

      await supabase.from("cobranca_parcelas").upsert({
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
      }, { onConflict: "cobranca_id, numero_parcela" }).maybeSingle();
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
      status: asaasStatus || (billingType === "PIX" ? "PENDING" : "CONFIRMED"),
      creditCardStatus: asaasStatus || undefined,
      paid: isPaid,
    }, 200);
  } catch (err: any) {
    console.error("[checkout-process-payment] Exceção inesperada:", err);
    return errorResponse(err.message || "Erro interno ao processar checkout", 500);
  }
});
