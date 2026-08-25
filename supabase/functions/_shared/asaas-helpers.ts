/**
 * Asaas helpers — resiliência para casos onde o email do cliente é rejeitado
 * pelo Asaas (não-ASCII) ou o customer legado não tem CPF cadastrado.
 *
 * Usar em toda edge function que criar/atualizar customer Asaas do fotógrafo.
 */

export function isAsaasSafeEmail(email?: string | null): boolean {
  if (!email) return false;
  return /^[\x21-\x7E]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(String(email).trim());
}

interface AsaasCustomerPayload {
  name?: string;
  email?: string;
  phone?: string;
  mobilePhone?: string;
  cpfCnpj?: string;
  postalCode?: string;
  address?: string;
  addressNumber?: string;
  complement?: string;
  province?: string;
  cityName?: string;
  state?: string;
  externalReference?: string;
  [k: string]: unknown;
}

/**
 * PUT /v3/customers/{id} com retry sem `email` quando o Asaas responde
 * `invalid_email`. Preserva CPF/telefone/endereço mesmo com email inválido.
 */
export async function putAsaasCustomer(
  baseUrl: string,
  accessToken: string,
  customerId: string,
  payload: AsaasCustomerPayload,
): Promise<{ ok: boolean; data: any; retriedWithoutEmail: boolean }> {
  // Remove campos undefined para não sobrescrever com null no Asaas
  const clean = Object.fromEntries(
    Object.entries(payload).filter(([, v]) => v !== undefined && v !== null && v !== ""),
  );

  const doPut = async (body: Record<string, unknown>) => {
    const res = await fetch(`${baseUrl}/v3/customers/${customerId}`, {
      method: "POST", // Asaas usa POST em /v3/customers/{id} para atualizar
      headers: { "Content-Type": "application/json", access_token: accessToken },
      body: JSON.stringify(body),
    });
    let data: any = null;
    try {
      data = await res.json();
    } catch {
      data = null;
    }
    return { res, data };
  };

  const first = await doPut(clean);
  if (first.res.ok) {
    return { ok: true, data: first.data, retriedWithoutEmail: false };
  }

  const errors = Array.isArray(first.data?.errors) ? first.data.errors : [];
  const isEmailError = errors.some((e: any) => {
    const code = String(e?.code || "").toLowerCase();
    const desc = String(e?.description || "").toLowerCase();
    return code.includes("invalid_email") || desc.includes("email");
  });

  if (isEmailError && "email" in clean) {
    const { email: _drop, ...rest } = clean;
    void _drop;
    const retry = await doPut(rest);
    return {
      ok: retry.res.ok,
      data: retry.data,
      retriedWithoutEmail: true,
    };
  }

  return { ok: false, data: first.data, retriedWithoutEmail: false };
}

/**
 * Antes de criar cobrança PIX/BOLETO, garante que o customer no Asaas tem
 * `cpfCnpj` preenchido. Se estiver vazio E temos CPF nos hints, faz um PUT
 * dedicado só com { cpfCnpj }.
 */
export async function ensureAsaasCustomerCpf(
  baseUrl: string,
  accessToken: string,
  customerId: string,
  cpfCnpj: string | undefined,
): Promise<{ ok: boolean; alreadyHad: boolean }> {
  try {
    const res = await fetch(`${baseUrl}/v3/customers/${customerId}`, {
      headers: { access_token: accessToken },
    });
    if (!res.ok) return { ok: false, alreadyHad: false };
    const cust = await res.json();
    if (cust?.cpfCnpj) return { ok: true, alreadyHad: true };
    if (!cpfCnpj) return { ok: false, alreadyHad: false };
    const put = await putAsaasCustomer(baseUrl, accessToken, customerId, { cpfCnpj });
    return { ok: put.ok, alreadyHad: false };
  } catch (err) {
    console.error("[ensureAsaasCustomerCpf] failed:", err);
    return { ok: false, alreadyHad: false };
  }
}

export interface AsaasFeeTier {
  min: number;
  max: number;
  percentageFee: number;
}

export interface NormalizedAsaasFees {
  creditCard: {
    operationValue: number;
    detachedMonthlyFeeValue: number;
    installmentMonthlyFeeValue: number;
    tiers: AsaasFeeTier[];
  };
  pix: {
    fixedFeeValue: number;
  };
  discount?: {
    active: boolean;
    expiration?: string;
    tiers: AsaasFeeTier[];
  };
}

export function normalizeAsaasFees(rawFees: any): NormalizedAsaasFees {
  if (!rawFees || typeof rawFees !== "object") {
    return {
      creditCard: {
        operationValue: 0.49,
        detachedMonthlyFeeValue: 1.25,
        installmentMonthlyFeeValue: 1.7,
        tiers: [
          { min: 1, max: 1, percentageFee: 2.99 },
          { min: 2, max: 6, percentageFee: 3.49 },
          { min: 7, max: 12, percentageFee: 3.99 },
          { min: 13, max: 21, percentageFee: 4.29 },
        ],
      },
      pix: { fixedFeeValue: 1.99 },
      discount: { active: false, tiers: [] },
    };
  }

  const paymentCc = rawFees.payment?.creditCard || rawFees.cardSale?.creditCard || rawFees.creditCard || {};
  const anticipationCc = rawFees.anticipation?.creditCard || rawFees.cardSale?.anticipation || {};
  const pixData = rawFees.payment?.pix || rawFees.pix || rawFees.pixDebit || {};

  if (Array.isArray(paymentCc.tiers) && paymentCc.tiers.length > 0) {
    return {
      creditCard: {
        operationValue: Number(paymentCc.operationValue ?? 0.49),
        detachedMonthlyFeeValue: Number(paymentCc.detachedMonthlyFeeValue ?? anticipationCc.detachedMonthlyFeeValue ?? 1.25),
        installmentMonthlyFeeValue: Number(paymentCc.installmentMonthlyFeeValue ?? anticipationCc.installmentMonthlyFeeValue ?? 1.7),
        tiers: paymentCc.tiers,
      },
      pix: {
        fixedFeeValue: Number(pixData.fixedFeeValue ?? pixData.fixedFeeValueWithDiscount ?? 1.99),
      },
      discount: rawFees.discount,
    };
  }

  const oneInstallment = Number(paymentCc.oneInstallmentPercentage ?? 2.99);
  const upToSix = Number(paymentCc.upToSixInstallmentsPercentage ?? 3.49);
  const upToTwelve = Number(paymentCc.upToTwelveInstallmentsPercentage ?? 3.99);
  const upToTwentyOne = Number(paymentCc.upToTwentyOneInstallmentsPercentage ?? 4.29);

  const tiers: AsaasFeeTier[] = [
    { min: 1, max: 1, percentageFee: oneInstallment },
    { min: 2, max: 6, percentageFee: upToSix },
    { min: 7, max: 12, percentageFee: upToTwelve },
    { min: 13, max: 21, percentageFee: upToTwentyOne },
  ];

  const hasDiscount = Boolean(paymentCc.hasValidDiscount);
  const discountTiers: AsaasFeeTier[] = hasDiscount
    ? [
        { min: 1, max: 1, percentageFee: Number(paymentCc.discountOneInstallmentPercentage ?? oneInstallment) },
        { min: 2, max: 6, percentageFee: Number(paymentCc.discountUpToSixInstallmentsPercentage ?? upToSix) },
        { min: 7, max: 12, percentageFee: Number(paymentCc.discountUpToTwelveInstallmentsPercentage ?? upToTwelve) },
        { min: 13, max: 21, percentageFee: Number(paymentCc.discountUpToTwentyOneInstallmentsPercentage ?? upToTwentyOne) },
      ]
    : [];

  const operationValue = Number(paymentCc.operationValue ?? 0.49);
  const detachedMonthly = Number(anticipationCc.detachedMonthlyFeeValue ?? anticipationCc.detachedPercentage ?? 1.25);
  const installmentMonthly = Number(anticipationCc.installmentMonthlyFeeValue ?? anticipationCc.installmentPercentage ?? 1.7);
  const pixFee = Number(pixData.fixedFeeValue ?? pixData.fixedFeeValueWithDiscount ?? 1.99);

  return {
    creditCard: {
      operationValue,
      detachedMonthlyFeeValue: detachedMonthly,
      installmentMonthlyFeeValue: installmentMonthly,
      tiers,
    },
    pix: {
      fixedFeeValue: pixFee,
    },
    discount: {
      active: hasDiscount && discountTiers.length > 0,
      expiration: paymentCc.discountExpiration || undefined,
      tiers: discountTiers,
    },
  };
}

export function calculateCreditFees(
  baseValue: number,
  installments: number,
  fees: NormalizedAsaasFees,
  repassarTaxas: boolean,
  repassarAntecipacao: boolean
): {
  totalValue: number;
  installmentValue: number;
  processingFee: number;
  anticipationFee: number;
} {
  const i = Math.max(1, installments);
  if (baseValue <= 0) {
    return { totalValue: 0, installmentValue: 0, processingFee: 0, anticipationFee: 0 };
  }

  let processingFee = 0;
  let anticipationFee = 0;

  if (repassarTaxas) {
    const activeTiers = fees.discount?.active && fees.discount.tiers.length > 0
      ? fees.discount.tiers
      : fees.creditCard.tiers;
    const tier = activeTiers.find((t) => i >= t.min && i <= t.max) || activeTiers[activeTiers.length - 1];
    const percentage = tier?.percentageFee ?? 0;
    processingFee = (baseValue * percentage / 100) + fees.creditCard.operationValue;
  }

  if (repassarAntecipacao) {
    const taxaMensal = i === 1
      ? fees.creditCard.detachedMonthlyFeeValue
      : fees.creditCard.installmentMonthlyFeeValue;

    if (taxaMensal > 0) {
      const valorParcelaBase = baseValue / i;
      let valorLiquidoTotal = 0;
      for (let j = 1; j <= i; j++) {
        const taxaTotalParcela = taxaMensal * j;
        const liquidoParcela = valorParcelaBase * (1 - taxaTotalParcela / 100);
        valorLiquidoTotal += liquidoParcela;
      }
      anticipationFee = Math.max(0, baseValue - valorLiquidoTotal);
    }
  }

  const totalValue = Math.round((baseValue + processingFee + anticipationFee) * 100) / 100;
  const installmentValue = Math.round((totalValue / i) * 100) / 100;

  return {
    totalValue,
    installmentValue,
    processingFee: Math.round(processingFee * 100) / 100,
    anticipationFee: Math.round(anticipationFee * 100) / 100,
  };
}

export const ASAAS_WEBHOOK_EVENTS = [
  "PAYMENT_CREATED",
  "PAYMENT_CONFIRMED",
  "PAYMENT_RECEIVED",
  "PAYMENT_ANTICIPATED",
  "PAYMENT_OVERDUE",
  "PAYMENT_DELETED",
  "PAYMENT_REFUNDED",
  "PAYMENT_PARTIALLY_REFUNDED",
  "PAYMENT_CHARGEBACK_REQUESTED",
  "PAYMENT_CHARGEBACK_DISPUTE",
  "PAYMENT_REPROVED_BY_RISK_ANALYSIS",
];

export async function ensureAsaasWebhookSubscription(
  baseUrl: string,
  apiKey: string,
  webhookUrl: string,
  email?: string
): Promise<{ ok: boolean; webhookId?: string; error?: string }> {
  try {
    const listRes = await fetch(`${baseUrl}/v3/webhooks`, {
      headers: { access_token: apiKey },
    });

    if (!listRes.ok) {
      console.warn(`[asaas-webhook-sync] Falha ao listar webhooks: status ${listRes.status}`);
      return { ok: false, error: `HTTP ${listRes.status}` };
    }

    const listData = await listRes.json();
    const existing = Array.isArray(listData.data)
      ? listData.data.find((w: any) => w.url === webhookUrl || w.name === "Lunari Studio Webhook" || w.name === "Lunari Gallery")
      : null;

    const payload = {
      name: "Lunari Studio Webhook",
      url: webhookUrl,
      email: email || "contato@lunarihub.com",
      enabled: true,
      interrupted: false,
      apiVersion: 3,
      sendType: "SEQUENTIALLY",
      events: ASAAS_WEBHOOK_EVENTS,
    };

    if (existing) {
      if (!existing.enabled || existing.interrupted || existing.url !== webhookUrl) {
        console.log(`[asaas-webhook-sync] Atualizando/Reativando webhook ${existing.id}...`);
        const putRes = await fetch(`${baseUrl}/v3/webhooks/${existing.id}`, {
          method: "PUT",
          headers: {
            access_token: apiKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });
        if (!putRes.ok) {
          console.warn(`[asaas-webhook-sync] Erro ao atualizar webhook: status ${putRes.status}`);
          return { ok: false, webhookId: existing.id, error: `HTTP ${putRes.status}` };
        }
      }
      return { ok: true, webhookId: existing.id };
    }

    // Criar novo webhook se não existir
    console.log(`[asaas-webhook-sync] Criando novo webhook Asaas para ${webhookUrl}...`);
    const postRes = await fetch(`${baseUrl}/v3/webhooks`, {
      method: "POST",
      headers: {
        access_token: apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const postData = await postRes.json();
    if (!postRes.ok || !postData.id) {
      console.warn('[asaas-webhook-sync] Erro ao criar webhook:', postData);
      return { ok: false, error: postData.errors?.[0]?.description || "Falha ao criar webhook" };
    }

    return { ok: true, webhookId: postData.id };
  } catch (err: any) {
    console.error("[asaas-webhook-sync] Exceção inesperada:", err);
    return { ok: false, error: err.message };
  }
}

export async function putAsaasCustomer(
  baseUrl: string,
  apiKey: string,
  customerId: string,
  payload: Record<string, any>
): Promise<{ ok: boolean; data?: any; error?: string }> {
  try {
    const res = await fetch($/v3/customers/{customerId}, {
      method: "PUT",
      headers: {
        access_token: apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      console.warn(`[asaas-helpers] Erro ao atualizar cliente ${customerId}:`, data);
      return { ok: false, error: data.errors?.[0]?.description || "Erro ao atualizar cliente" };
    }
    return { ok: true, data };
  } catch (err: any) {
    console.error(`[asaas-helpers] Exceção ao atualizar cliente ${customerId}:`, err);
    return { ok: false, error: err.message };
  }
}
