// supabase/functions/_shared/adapters/asaas.ts
// Adaptador direto do Asaas para o create-cobranca e checkout-process-payment

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

function normalizePhone(v?: string | null): string | undefined {
  const d = digitsOnly(v);
  if (!d) return undefined;
  const local = d.length > 11 && d.startsWith("55") ? d.slice(2) : d;
  return local.length === 10 || local.length === 11 ? local : undefined;
}

export async function ensureAsaasCustomer(
  baseUrl: string,
  apiKey: string,
  cliente: any
): Promise<{ customerId: string; error?: string }> {
  const doc = digitsOnly(cliente?.cpfCnpj);
  const email = cleanEmail(cliente?.email);
  const phone = normalizePhone(cliente?.whatsapp || cliente?.telefone);
  const name = cliente?.nome?.trim() || "Cliente Lunari";

  if (doc) {
    const searchRes = await fetch(`${baseUrl}/v3/customers?cpfCnpj=${doc}`, {
      headers: { access_token: apiKey },
    });
    if (searchRes.ok) {
      const searchData = await searchRes.json();
      if (searchData.data && searchData.data.length > 0) {
        return { customerId: searchData.data[0].id };
      }
    }
  }

  if (email) {
    const searchRes = await fetch(`${baseUrl}/v3/customers?email=${encodeURIComponent(email)}`, {
      headers: { access_token: apiKey },
    });
    if (searchRes.ok) {
      const searchData = await searchRes.json();
      if (searchData.data && searchData.data.length > 0) {
        return { customerId: searchData.data[0].id };
      }
    }
  }

  const createPayload: Record<string, any> = {
    name,
    email: email || undefined,
    mobilePhone: phone || undefined,
    phone: phone || undefined,
    cpfCnpj: doc || undefined,
    notificationDisabled: true,
  };

  if (cliente?.cep && cliente?.endereco) {
    createPayload.postalCode = digitsOnly(cliente.cep);
    createPayload.address = cliente.endereco;
    createPayload.addressNumber = cliente.numero || "S/N";
    createPayload.complement = cliente.complemento || undefined;
    createPayload.province = cliente.bairro || undefined;
  }

  const createRes = await fetch(`${baseUrl}/v3/customers`, {
    method: "POST",
    headers: {
      access_token: apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(createPayload),
  });

  const createData = await createRes.json();

  if (!createRes.ok || !createData.id) {
    console.error("[asaas-adapter] Falha ao criar cliente no Asaas:", createData);
    return { customerId: "", error: createData.errors?.[0]?.description || "Erro ao registrar cliente no Asaas" };
  }

  return { customerId: createData.id };
}

export async function createAsaasPayment(
  supabase: SupabaseClient,
  input: AdapterCreatePaymentInput,
  publicSiteUrl: string = "https://app.lunarihub.com"
): Promise<AdapterCreatePaymentOutput> {
  const {
    cobrancaId,
    userId,
    valor,
    descricao,
    cliente,
    billingType,
    creditCard,
    creditCardHolderInfo,
    installmentCount,
    integrationData,
  } = input;

  const socialShareUrl = `${publicSiteUrl}/l/${cobrancaId}`;

  // Se a requisição for para geração de LINK de pagamento (sem cartão e sem PIX presencial)
  // Devolve imediatamente o link do checkout público Lunari
  if (billingType === "LINK" || (!creditCard && billingType !== "PIX")) {
    return {
      success: true,
      providerOrderId: cobrancaId,
      checkoutUrl: socialShareUrl,
    };
  }

  let apiKey = integrationData?.accessToken;
  let dadosExtras = integrationData?.dadosExtras;

  if (!apiKey) {
    const { data: integ, error: integErr } = await supabase
      .from("usuarios_integracoes")
      .select("access_token, dados_extras")
      .eq("user_id", userId)
      .eq("provedor", "asaas")
      .eq("status", "ativo")
      .order("is_default", { ascending: false })
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (integErr || !integ?.access_token) {
      return {
        success: false,
        error: "Integração Asaas não configurada ou inativa para este fotógrafo",
        errorCode: "ASAAS_NOT_CONFIGURED",
      };
    }

    apiKey = integ.access_token;
    dadosExtras = integ.dados_extras;
  }

  const settings = (dadosExtras || {}) as {
    environment?: string;
    absorverTaxa?: boolean;
  };

  const baseUrl = settings.environment === "production"
    ? "https://api.asaas.com"
    : "https://api-sandbox.asaas.com";

  const { customerId, error: custErr } = await ensureAsaasCustomer(baseUrl, apiKey, cliente);
  if (custErr || !customerId) {
    return {
      success: false,
      error: custErr || "Falha ao vincular cliente no Asaas",
      errorCode: "ASAAS_CUSTOMER_ERROR",
    };
  }

  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  const installments = installmentCount && installmentCount > 1 ? installmentCount : undefined;

  const paymentPayload: Record<string, any> = {
    customer: customerId,
    billingType: billingType || "PIX",
    value: Math.round(Number(valor) * 100) / 100,
    dueDate: tomorrow,
    description: descricao || "Serviço fotográfico",
    externalReference: cobrancaId,
  };

  if (installments && installments > 1) {
    paymentPayload.installmentCount = installments;
    paymentPayload.installmentValue = Math.round((valor / installments) * 100) / 100;
  }

  if (billingType === "CREDIT_CARD" && creditCard) {
    paymentPayload.creditCard = {
      holderName: creditCard.holderName,
      number: digitsOnly(creditCard.number),
      expiryMonth: creditCard.expiryMonth,
      expiryYear: creditCard.expiryYear,
      ccv: creditCard.ccv,
    };

    const holder = creditCardHolderInfo || {};
    paymentPayload.creditCardHolderInfo = {
      name: holder.name || cliente?.nome || creditCard.holderName,
      email: cleanEmail(holder.email) || cleanEmail(cliente?.email) || "cliente@lunarihub.com",
      cpfCnpj: digitsOnly(holder.cpfCnpj) || digitsOnly(cliente?.cpfCnpj) || "",
      postalCode: digitsOnly(holder.postalCode) || digitsOnly(cliente?.cep) || "",
      addressNumber: holder.addressNumber || cliente?.numero || "S/N",
      phone: normalizePhone(holder.phone) || normalizePhone(cliente?.whatsapp || cliente?.telefone) || "",
    };
  }

  console.log(`[asaas-adapter] Criando cobrança no Asaas para cobranca=${cobrancaId}, billingType=${paymentPayload.billingType}, valor=${valor}`);

  const payRes = await fetch(`${baseUrl}/v3/payments`, {
    method: "POST",
    headers: {
      access_token: apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(paymentPayload),
  });

  const payData = await payRes.json();

  if (!payRes.ok || !payData.id) {
    console.error("[asaas-adapter] Erro na resposta do Asaas:", payData);
    return {
      success: false,
      error: payData.errors?.[0]?.description || "Erro ao processar pagamento no Asaas",
      errorCode: "ASAAS_API_ERROR",
    };
  }

  let pixCopiaCola: string | undefined;
  let pixQrCodeBase64: string | undefined;

  if (payData.billingType === "PIX") {
    try {
      const qrRes = await fetch(`${baseUrl}/v3/payments/${payData.id}/pixQrCode`, {
        headers: { access_token: apiKey },
      });
      if (qrRes.ok) {
        const qrData = await qrRes.json();
        pixCopiaCola = qrData.payload;
        pixQrCodeBase64 = qrData.encodedImage;
      }
    } catch (qrErr) {
      console.warn("[asaas-adapter] Falha não impeditiva ao buscar QR Code Pix:", qrErr);
    }
  }

  return {
    success: true,
    providerOrderId: payData.id,
    checkoutUrl: payData.invoiceUrl || payData.bankSlipUrl || socialShareUrl,
    pixCopiaCola,
    pixQrCodeBase64,
    dadosExtras: {
      customerId,
      paymentId: payData.id,
      invoiceUrl: payData.invoiceUrl,
      bankSlipUrl: payData.bankSlipUrl,
      netValue: payData.netValue,
      installmentId: payData.installment || null,
      status: payData.status,
    },
  };
}
