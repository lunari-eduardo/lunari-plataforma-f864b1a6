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

  const preferencePayload: Record<string, any> = {
    items: [
      {
        id: cobrancaId,
        title: descricao || "Serviço fotográfico",
        quantity: 1,
        currency_id: "BRL",
        unit_price: Math.round(Number(valor) * 100) / 100,
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
