// supabase/functions/create-mercadopago-payment/index.ts
// Adaptador técnico para a API do Mercado Pago (Service Role Only)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.2";
import { requireServiceRole, corsHeaders, jsonResponse, errorResponse } from "../_shared/auth-guard.ts";
import { AdapterCreatePaymentInput, AdapterCreatePaymentOutput } from "../_shared/payment-types.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const PUBLIC_SITE_URL = (Deno.env.get("VITE_SITE_URL") || Deno.env.get("SITE_URL") || "https://app.lunarihub.com").replace(/\/$/, "");

function cleanEmail(v?: string | null): string | undefined {
  if (!v) return undefined;
  const email = v.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : undefined;
}

function digitsOnly(v?: string | null): string {
  return v ? String(v).replace(/\D/g, "") : "";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // 🔒 GATE DE SEGURANÇA: Somente chamadas internas autorizadas
  const serviceCheck = requireServiceRole(req);
  if (!serviceCheck.isServiceRole) {
    return serviceCheck.errorResponse;
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const body: AdapterCreatePaymentInput = await req.json();
    const { cobrancaId, userId, valor, descricao, cliente, integrationData } = body;

    if (!cobrancaId || !userId || !valor || valor <= 0) {
      return errorResponse("cobrancaId, userId e valor (>0) são obrigatórios", 400);
    }

    // 1. Obter token e configurações do Mercado Pago
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
        return errorResponse("Integração Mercado Pago não configurada ou inativa para este fotógrafo", 400, "MP_NOT_CONFIGURED");
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

    // 2. Configurar métodos de pagamento excluídos se desabilitados
    const excludedPaymentTypes: Array<{ id: string }> = [];
    if (!pixHabilitado) {
      excludedPaymentTypes.push({ id: "bank_transfer" });
    }
    if (!cartaoHabilitado) {
      excludedPaymentTypes.push({ id: "credit_card" });
      excludedPaymentTypes.push({ id: "debit_card" });
    }

    // 3. Montar dados do pagador
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

    // 4. Montar payload da preferência no Mercado Pago
    const webhookUrl = `${SUPABASE_URL}/functions/v1/mercadopago-webhook`;
    const backUrl = `${PUBLIC_SITE_URL}/l/${cobrancaId}`;

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
        correlation_id: body.correlationId,
      },
    };

    console.log(`[create-mercadopago-payment] Criando preferência MP para cobranca=${cobrancaId}, valor=${valor}`);

    // 5. Chamar API do Mercado Pago
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
      console.error("[create-mercadopago-payment] Erro na resposta do MP:", mpData);
      return jsonResponse({
        success: false,
        error: mpData.message || "Erro ao gerar preferência no Mercado Pago",
        errorCode: "MP_API_ERROR",
        details: mpData,
      } as AdapterCreatePaymentOutput, 400);
    }

    const output: AdapterCreatePaymentOutput = {
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

    return jsonResponse(output, 200);
  } catch (err: any) {
    console.error("[create-mercadopago-payment] Exceção inesperada:", err);
    return errorResponse(err.message || "Falha ao processar criação de pagamento no Mercado Pago", 500);
  }
});
