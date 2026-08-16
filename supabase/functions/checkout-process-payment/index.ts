// supabase/functions/checkout-process-payment/index.ts
// Terminal público de checkout transparente do Asaas, validando formulário do cliente,
// enriquecendo CRM e delegando a execução ao adaptador create-asaas-payment.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.2";
import { corsHeaders, jsonResponse, errorResponse } from "../_shared/auth-guard.ts";
import { AdapterCreatePaymentInput, AdapterCreatePaymentOutput, ClienteContact } from "../_shared/payment-types.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

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

    // 3. Invocar o adaptador create-asaas-payment via Service Role
    const adapterUrl = `${SUPABASE_URL}/functions/v1/create-asaas-payment`;
    const adapterPayload: AdapterCreatePaymentInput = {
      cobrancaId: cobranca.id,
      userId: cobranca.user_id,
      valor: Number(cobranca.valor),
      descricao: cobranca.descricao || "Serviço fotográfico",
      cliente: mergedCliente,
      integrationData: {},
      billingType,
      creditCard,
      creditCardHolderInfo,
      installmentCount,
    };

    console.log(`[checkout-process-payment] Delegando ao create-asaas-payment para cobranca=${cobranca.id}, billingType=${billingType}`);

    const adapterRes = await fetch(adapterUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
        "x-lunari-internal-caller": "checkout-process-payment",
      },
      body: JSON.stringify(adapterPayload),
    });

    const adapterData: AdapterCreatePaymentOutput = await adapterRes.json();

    if (!adapterRes.ok || !adapterData.success) {
      console.error("[checkout-process-payment] Adaptador Asaas retornou erro:", adapterData);
      return jsonResponse({
        success: false,
        error: adapterData.error || "Erro ao processar pagamento",
        code: adapterData.errorCode || "ASAAS_ERROR",
      }, 400);
    }

    // 4. Atualizar registro da cobrança
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
      },
      updated_at: new Date().toISOString(),
    };

    if (billingType === "PIX") {
      updatePayload.tipo_cobranca = "pix";
    } else if (billingType === "CREDIT_CARD") {
      updatePayload.tipo_cobranca = "cartao";
      if (installmentCount) updatePayload.total_parcelas = installmentCount;
    }

    await supabase.from("cobrancas").update(updatePayload).eq("id", cobranca.id);

    console.log(`[checkout-process-payment] Cobrança ${cobranca.id} processada com sucesso!`);

    return jsonResponse({
      success: true,
      paymentId: adapterData.providerOrderId,
      cobrancaId: cobranca.id,
      pixQrCode: adapterData.pixCopiaCola,
      pixQrCodeBase64: adapterData.pixQrCodeBase64,
      invoiceUrl: adapterData.checkoutUrl,
      billingType,
    }, 200);
  } catch (err: any) {
    console.error("[checkout-process-payment] Exceção inesperada:", err);
    return errorResponse(err.message || "Erro interno ao processar checkout", 500);
  }
});
