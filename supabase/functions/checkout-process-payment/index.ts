// supabase/functions/checkout-process-payment/index.ts
// Terminal público de checkout transparente do Asaas, validando formulário do cliente,
// enriquecendo CRM e delegando a execução ao adaptador create-asaas-payment.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.2";
import { corsHeaders, jsonResponse, errorResponse } from "../_shared/auth-guard.ts";
import { AdapterCreatePaymentInput, AdapterCreatePaymentOutput, ClienteContact } from "../_shared/payment-types.ts";
import { normalizeAsaasFees, calculateCreditFees } from "../_shared/asaas-helpers.ts";
import { createAsaasPayment } from "../_shared/adapters/asaas.ts";

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
    const { cobrancaId, billingType, installmentCount, creditCard, creditCardHolderInfo, payerContact } = body;

    if (!cobrancaId || !billingType) {
      return errorResponse("cobrancaId e billingType são obrigatórios", 400);
    }

    // 1. Buscar cobrança
    const { data: cobranca, error: cobrancaError } = await supabase
      .from("cobrancas")
      .select("id, user_id, cliente_id, session_id, valor, descricao, status, provedor, dados_extras")
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
    const { data: cliente } = await supabase
      .from("clientes")
      .select("id, nome, email, telefone, whatsapp, cpf_cnpj, cep, endereco, numero, complemento, bairro, cidade, estado")
      .eq("id", cobranca.cliente_id)
      .maybeSingle();

    if (payerContact && cobranca.cliente_id) {
      const patch: Record<string, string> = {};
      const isEmpty = (v: unknown) => v == null || (typeof v === "string" && v.trim() === "");

      if (payerContact.name?.trim() && isEmpty(cliente?.nome)) patch.nome = payerContact.name.trim();
      if (payerContact.email?.trim() && isEmpty(cliente?.email)) patch.email = payerContact.email.trim().toLowerCase();
      if (payerContact.phone?.trim() && isEmpty(cliente?.whatsapp) && isEmpty(cliente?.telefone)) {
        patch.whatsapp = payerContact.phone.trim();
      }
      if (payerContact.cpfCnpj?.trim() && isEmpty(cliente?.cpf_cnpj)) {
        patch.cpf_cnpj = payerContact.cpfCnpj.trim();
      }

      if (Object.keys(patch).length > 0) {
        await supabase.from("clientes").update(patch).eq("id", cobranca.cliente_id);
        console.log(`[checkout-process-payment] CRM enriquecido:`, Object.keys(patch));
      }
    }

    const mergedCliente: ClienteContact = {
      id: cobranca.cliente_id || undefined,
      nome: payerContact?.name || cliente?.nome || creditCard?.holderName || "Cliente",
      email: payerContact?.email || cliente?.email || creditCardHolderInfo?.email,
      telefone: payerContact?.phone || cliente?.whatsapp || cliente?.telefone || creditCardHolderInfo?.phone,
      whatsapp: payerContact?.phone || cliente?.whatsapp || cliente?.telefone || creditCardHolderInfo?.phone,
      cpfCnpj: payerContact?.cpfCnpj || cliente?.cpf_cnpj || creditCardHolderInfo?.cpfCnpj,
      cep: cliente?.cep || creditCardHolderInfo?.postalCode,
      endereco: cliente?.endereco,
      numero: cliente?.numero || creditCardHolderInfo?.addressNumber,
      complemento: cliente?.complemento,
      bairro: cliente?.bairro,
      cidade: cliente?.cidade,
      uf: cliente?.estado,
    };

    // 3. Buscar integração do Asaas para resolução de taxas
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

    const globalSettings = (integracao?.dados_extras || {}) as {
      environment?: string;
      absorverTaxa?: boolean;
      ireiAntecipar?: boolean;
      repassarTaxaAntecipacao?: boolean;
      incluirTaxaAntecipacao?: boolean;
    };

    const asaasBaseUrl = globalSettings.environment === "production"
      ? "https://api.asaas.com"
      : "https://api-sandbox.asaas.com";

    // Resolução de preferências de taxa: overrides por cobrança > configuração global
    const chargeOverrides = (cobranca.dados_extras || {}) as {
      repassarTaxasProcessamento?: boolean;
      anteciparParcelas?: boolean;
      repassarTaxaAntecipacao?: boolean;
    };
    const hasOverrides = Object.keys(chargeOverrides).length > 0;

    const legacyAntecipar = globalSettings.incluirTaxaAntecipacao === true;
    const globalAbsorverTaxa = globalSettings.absorverTaxa === true;
    const globalIreiAntecipar = globalSettings.ireiAntecipar ?? legacyAntecipar;
    const globalRepassarAntecipacao = globalIreiAntecipar ? (globalSettings.repassarTaxaAntecipacao ?? legacyAntecipar) : false;

    const repassarTaxas = hasOverrides && chargeOverrides.repassarTaxasProcessamento !== undefined
      ? chargeOverrides.repassarTaxasProcessamento
      : !globalAbsorverTaxa;
    const ireiAntecipar = hasOverrides && chargeOverrides.anteciparParcelas !== undefined
      ? chargeOverrides.anteciparParcelas
      : globalIreiAntecipar;
    const repassarAntecipacao = ireiAntecipar
      ? (hasOverrides && chargeOverrides.repassarTaxaAntecipacao !== undefined ? chargeOverrides.repassarTaxaAntecipacao : globalRepassarAntecipacao)
      : false;

    const baseValue = Number(cobranca.valor);
    let finalValue = baseValue;
    let finalInstallments = 1;
    let taxaProcessamento = 0;
    let taxaAntecipacao = 0;

    if (billingType === "CREDIT_CARD") {
      finalInstallments = Math.max(1, installmentCount || 1);

      // Calcular taxas de cartão se repasse estiver ativo
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

        console.log(`[checkout-process-payment] Cartão ${finalInstallments}x: base=${baseValue}, proc=${taxaProcessamento}, antec=${taxaAntecipacao}, total=${finalValue}`);
      }
    } else {
      // REGRA EXPLICITA: PIX NUNCA repassa taxas ao cliente final
      finalValue = baseValue;
      finalInstallments = 1;
      taxaProcessamento = 0;
      taxaAntecipacao = 0;
    }

    // 4. Invocar o adaptador create-asaas-payment via Service Role
    const adapterUrl = `${SUPABASE_URL}/functions/v1/create-asaas-payment`;
    const adapterPayload: AdapterCreatePaymentInput = {
      cobrancaId: cobranca.id,
      userId: cobranca.user_id,
      valor: finalValue,
      descricao: cobranca.descricao || "Serviço fotográfico",
      cliente: mergedCliente,
      integrationData: {},
      billingType,
      creditCard,
      creditCardHolderInfo,
      installmentCount: finalInstallments,
    };

    // 4. Invocar o adaptador Asaas diretamente em processo
    const adapterData: AdapterCreatePaymentOutput = await createAsaasPayment(
      supabase,
      adapterPayload,
      PUBLIC_SITE_URL
    );

    if (!adapterData.success) {
      console.error("[checkout-process-payment] Adaptador Asaas retornou erro:", adapterData);
      return jsonResponse({
        success: false,
        error: adapterData.error || "Erro ao processar pagamento",
        code: adapterData.errorCode || "ASAAS_ERROR",
      }, 400);
    }

    // 5. Atualizar registro da cobrança com IDs e breakdown de taxas
    const updatePayload: Record<string, any> = {
      provider_order_id: adapterData.providerOrderId || null,
      asaas_payment_id: adapterData.providerOrderId || null,
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

    if (billingType === "PIX") {
      updatePayload.tipo_cobranca = "pix";
    } else if (billingType === "CREDIT_CARD") {
      updatePayload.tipo_cobranca = "cartao";
      if (finalInstallments) updatePayload.total_parcelas = finalInstallments;
    }

    await supabase.from("cobrancas").update(updatePayload).eq("id", cobranca.id);

    console.log(`[checkout-process-payment] Cobrança ${cobranca.id} processada com sucesso!`);

    const asaasStatus = adapterData.dadosExtras?.status;
    const isPaid = asaasStatus === "CONFIRMED" || asaasStatus === "RECEIVED";

    return jsonResponse({
      success: true,
      paymentId: adapterData.providerOrderId,
      cobrancaId: cobranca.id,
      pixQrCode: adapterData.pixCopiaCola,
      pixQrCodeBase64: adapterData.pixQrCodeBase64,
      invoiceUrl: adapterData.checkoutUrl,
      billingType,
      status: asaasStatus || (billingType === "PIX" ? "PENDING" : "CONFIRMED"),
      creditCardStatus: asaasStatus || "CONFIRMED",
      paid: isPaid,
    }, 200);
  } catch (err: any) {
    console.error("[checkout-process-payment] Exceção inesperada:", err);
    return errorResponse(err.message || "Erro interno ao processar checkout", 500);
  }
});
