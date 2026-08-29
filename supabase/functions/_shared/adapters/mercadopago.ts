// supabase/functions/_shared/adapters/mercadopago.ts
// Adaptador direto do Mercado Pago para o create-cobranca

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.2";
import { AdapterCreatePaymentInput, AdapterCreatePaymentOutput } from "../payment-types.ts";

function cleanEmail(v?: string | null): string | undefined {
  if (!v) return undefined;
  const email = v.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : undefined;
}

function digitsOnly(v?: string | null): string {
  return v ? String(v).replace(/\D/g, "") : "";
}

export async function createMercadoPagoPayment(
  supabase: SupabaseClient,
  input: AdapterCreatePaymentInput,
  supabaseUrl: string,
  publicSiteUrl: string
): Promise<AdapterCreatePaymentOutput> {
  const { cobrancaId, userId, valor, descricao, cliente, integrationData } = input;

  let accessToken = integrationData?.accessToken;
  let dadosExtras = integrationData?.dadosExtras;

  if (!accessToken) {
    const { data: integ, error: integErr } = await supabase
      .from("usuarios_integracoes")
      .select("access_token, dados_extras")
      .eq("user_id", userId)
      .eq("provedor", "mercadopago")
      .eq("status", "ativo")
      .maybeSingle();

    if (integErr || !integ?.access_token) {
      return {
        success: false,
        error: "Integração Mercado Pago não configurada ou inativa para este fotógrafo",
        errorCode: "MP_NOT_CONFIGURED",
      };
    }

    accessToken = integ.access_token;
    dadosExtras = integ.dados_extras;
  }

  const settings = (dadosExtras || {}) as {
    habilitarPix?: boolean;
    habilitarCartao?: boolean;
    maxParcelas?: number;
  };

  const pixHabilitado = settings.habilitarPix !== false;
  const cartaoHabilitado = settings.habilitarCartao !== false;
  const maxParcelas = Math.min(Math.max(Number(settings.maxParcelas) || 12, 1), 12);

  const excludedPaymentTypes: Array<{ id: string }> = [];
  if (!pixHabilitado) {
    excludedPaymentTypes.push({ id: "bank_transfer" });
  }
  if (!cartaoHabilitado) {
    excludedPaymentTypes.push({ id: "credit_card" });
    excludedPaymentTypes.push({ id: "debit_card" });
  }

  const clientPhoneDigits = digitsOnly(cliente?.whatsapp || cliente?.telefone);
  const docDigits = digitsOnly(cliente?.cpfCnpj);

  const payerPayload: Record<string, any> = {
    name: cliente?.nome?.trim() || "Cliente",
    email: cleanEmail(cliente?.email) || "cliente@lunarihub.com",
  };

  if (clientPhoneDigits) {
    const areaCode = clientPhoneDigits.length >= 10 ? clientPhoneDigits.slice(0, 2) : "11";
    const phoneNumber = clientPhoneDigits.length >= 10 ? clientPhoneDigits.slice(2) : clientPhoneDigits;
    payerPayload.phone = { area_code: areaCode, number: phoneNumber };
  }

  if (docDigits && (docDigits.length === 11 || docDigits.length === 14)) {
    payerPayload.identification = {
      type: docDigits.length === 11 ? "CPF" : "CNPJ",
      number: docDigits,
    };
  }

  if (cliente?.cep && cliente?.endereco) {
    payerPayload.address = {
      zip_code: digitsOnly(cliente.cep),
      street_name: cliente.endereco,
      street_number: Number(digitsOnly(cliente.numero)) || 0,
    };
  }

  const webhookUrl = `${supabaseUrl}/functions/v1/mercadopago-webhook`;
  const backUrl = `${publicSiteUrl}/l/${cobrancaId}`;
  const transactionAmount = Math.round(Number(valor) * 100) / 100;
  
  if (input.billingType === 'PIX') {
    console.log(`[mercadopago-adapter] Criando PIX MP para cobranca=${cobrancaId}, valor=${valor}`);
    const pixPayload = {
      transaction_amount: transactionAmount,
      description: descricao || "Serviço fotográfico",
      payment_method_id: "pix",
      payer: payerPayload,
      external_reference: cobrancaId,
      notification_url: webhookUrl,
      metadata: {
        cobranca_id: cobrancaId,
        user_id: userId,
        correlation_id: input.correlationId,
      },
    };

    const mpRes = await fetch("https://api.mercadopago.com/v1/payments", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "X-Idempotency-Key": cobrancaId + "-pix",
      },
      body: JSON.stringify(pixPayload),
    });
    
    const mpData = await mpRes.json();
    
    if (!mpRes.ok || !mpData.id) {
      console.error("[mercadopago-adapter] Erro na API Pix do MP:", mpData);
      return {
        success: false,
        error: mpData.message || mpData.error || "Erro ao processar Pix no Mercado Pago",
        errorCode: "MP_API_ERROR",
      };
    }
    
    const qrCode = mpData.point_of_interaction?.transaction_data?.qr_code;
    const qrCodeBase64 = mpData.point_of_interaction?.transaction_data?.qr_code_base64;
    
    return {
      success: true,
      providerOrderId: String(mpData.id),
      pixCopiaCola: qrCode,
      pixQrCodeBase64: qrCodeBase64,
      dadosExtras: {
        paymentId: mpData.id,
        status: mpData.status,
        statusDetail: mpData.status_detail,
        netValue: mpData.transaction_details?.net_received_amount,
        feeDetails: mpData.fee_details,
      }
    };
  }
  
  if (input.billingType === 'CREDIT_CARD') {
    console.log(`[mercadopago-adapter] Criando Cartão MP para cobranca=${cobrancaId}, valor=${valor}`);
    
    const paymentMethodId = input.requestDadosExtras?.paymentMethodId || 'visa'; // Defaulting to visa if missing, though frontend should pass it
    const token = input.cardToken;
    
    if (!token) {
      return { success: false, error: "Token de cartão ausente", errorCode: "MP_MISSING_TOKEN" };
    }
    
    const cardPayload = {
      transaction_amount: transactionAmount,
      token: token,
      description: descricao || "Serviço fotográfico",
      installments: input.installmentCount || 1,
      payment_method_id: paymentMethodId,
      payer: payerPayload,
      external_reference: cobrancaId,
      notification_url: webhookUrl,
      metadata: {
        cobranca_id: cobrancaId,
        user_id: userId,
        correlation_id: input.correlationId,
      },
    };
    
    // Antifraude device session id se existir
    if (input.requestDadosExtras?.deviceId) {
       (cardPayload as any).device_id = input.requestDadosExtras.deviceId;
    }

    const mpRes = await fetch("https://api.mercadopago.com/v1/payments", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "X-Idempotency-Key": cobrancaId + "-card",
      },
      body: JSON.stringify(cardPayload),
    });
    
    const mpData = await mpRes.json();
    
    if (!mpRes.ok || !mpData.id) {
      console.error("[mercadopago-adapter] Erro na API Cartão do MP:", mpData);
      return {
        success: false,
        error: mpData.message || mpData.error || "Erro ao processar cartão no Mercado Pago",
        errorCode: "MP_API_ERROR",
        dadosExtras: { mpError: mpData },
      };
    }
    
    // Status approved ou in_process significa sucesso na requisição
    if (mpData.status === 'rejected') {
      return {
        success: false,
        error: `Pagamento recusado (${mpData.status_detail})`,
        errorCode: "MP_REJECTED",
        dadosExtras: { status_detail: mpData.status_detail, paymentId: mpData.id }
      };
    }

    return {
      success: true,
      providerOrderId: String(mpData.id),
      dadosExtras: {
        paymentId: mpData.id,
        status: mpData.status,
        statusDetail: mpData.status_detail,
        netValue: mpData.transaction_details?.net_received_amount,
        feeDetails: mpData.fee_details,
      }
    };
  }

  // Fallback genérico para preferência (caso o billingType não seja enviado, ou link)
  const preferencePayload: Record<string, any> = {
    items: [
      {
        id: cobrancaId,
        title: descricao || "Serviço fotográfico",
        quantity: 1,
        currency_id: "BRL",
        unit_price: transactionAmount,
      },
    ],
    payer: payerPayload,
    external_reference: cobrancaId,
    notification_url: webhookUrl,
    back_urls: {
      success: backUrl,
      pending: backUrl,
      failure: backUrl,
    },
    auto_return: "approved",
    payment_methods: {
      excluded_payment_types: excludedPaymentTypes,
      installments: maxParcelas,
    },
    metadata: {
      cobranca_id: cobrancaId,
      user_id: userId,
      correlation_id: input.correlationId,
    },
  };

  console.log(`[mercadopago-adapter] Criando preferência MP para cobranca=${cobrancaId}, valor=${valor}`);

  const mpRes = await fetch("https://api.mercadopago.com/checkout/preferences", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "X-Idempotency-Key": cobrancaId,
    },
    body: JSON.stringify(preferencePayload),
  });

  const mpData = await mpRes.json();

  if (!mpRes.ok || !mpData.id || !mpData.init_point) {
    console.error("[mercadopago-adapter] Erro na resposta do MP:", mpData);
    return {
      success: false,
      error: mpData.message || "Erro ao gerar preferência no Mercado Pago",
      errorCode: "MP_API_ERROR",
    };
  }

  return {
    success: true,
    providerOrderId: mpData.id,
    checkoutUrl: mpData.init_point,
    dadosExtras: {
      preferenceId: mpData.id,
      initPoint: mpData.init_point,
      sandboxInitPoint: mpData.sandbox_init_point,
      collectorId: mpData.collector_id,
    },
  };
}
