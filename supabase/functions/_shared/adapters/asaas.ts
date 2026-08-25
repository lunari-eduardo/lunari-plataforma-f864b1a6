// supabase/functions/_shared/adapters/asaas.ts
// Adaptador direto do Asaas para o create-cobranca e checkout-process-payment

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.2";
import { AdapterCreatePaymentInput, AdapterCreatePaymentOutput } from "../payment-types.ts";
import { ensureAsaasWebhookSubscription, normalizeAsaasFees, calculateCreditFees, putAsaasCustomer } from "../asaas-helpers.ts";

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
  
  let existingCustomer: any = null;

  if (doc) {
    const searchRes = await fetch(`${baseUrl}/v3/customers?cpfCnpj=${doc}`, {
      headers: { access_token: apiKey },
    });
    if (searchRes.ok) {
      const searchData = await searchRes.json();
      if (searchData.data && searchData.data.length > 0) {
        existingCustomer = searchData.data[0];
      }
    }
  }

  if (!existingCustomer && email) {
    const searchRes = await fetch(`${baseUrl}/v3/customers?email=${encodeURIComponent(email)}`, {
      headers: { access_token: apiKey },
    });
    if (searchRes.ok) {
      const searchData = await searchRes.json();
      if (searchData.data && searchData.data.length > 0) {
        existingCustomer = searchData.data[0];
      }
    }
  }
  
  if (existingCustomer) {
    // Se o cliente existe, mas não tem o cpfCnpj preenchido no Asaas, vamos atualizar agora
    if (doc && (!existingCustomer.cpfCnpj || digitsOnly(existingCustomer.cpfCnpj) !== doc)) {
      await putAsaasCustomer(baseUrl, apiKey, existingCustomer.id, {
        cpfCnpj: doc,
        name: existingCustomer.name || name, // Mantém o nome antigo se houver, ou atualiza
        mobilePhone: existingCustomer.mobilePhone || phone,
      });
    }
    return { customerId: existingCustomer.id };
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
    // Fallback: se deu erro por conta do e-mail inválido, tentar sem e-mail
    const isEmailError = (createData.errors || []).some((e: any) => 
      String(e.code || "").includes("invalid_email") || String(e.description || "").toLowerCase().includes("email")
    );
    
    if (isEmailError && createPayload.email) {
      delete createPayload.email;
      const retryRes = await fetch(`${baseUrl}/v3/customers`, {
        method: "POST",
        headers: { access_token: apiKey, "Content-Type": "application/json" },
        body: JSON.stringify(createPayload),
      });
      const retryData = await retryRes.json();
      if (retryRes.ok && retryData.id) {
        return { customerId: retryData.id };
      }
      console.error("[asaas-adapter] Falha ao criar cliente no Asaas (retry sem email):", retryData);
      return { customerId: "", error: retryData.errors?.[0]?.description || "Erro ao registrar cliente no Asaas" };
    }
    
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

  const rawSettings = (dadosExtras || {}) as Record<string, any>;
  const settings = {
    ...((rawSettings.gestao_settings as Record<string, any>) || {}),
    ...((rawSettings.gallery_settings as Record<string, any>) || {}),
    ...rawSettings,
  };

  const baseUrl = settings.environment === "production"
    ? "https://api.asaas.com"
    : "https://api-sandbox.asaas.com";

  // Auto-provisionar ou reativar o webhook do Asaas silenciosamente
  const webhookUrl = "https://tlnjspsywycbudhewsfv.supabase.co/functions/v1/asaas-webhook";
  ensureAsaasWebhookSubscription(baseUrl, apiKey, webhookUrl).catch((e) => {
    console.warn("[asaas-adapter] Falha não impeditiva ao auto-provisionar webhook:", e);
  });

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

  // Validação prévia de documento para PIX
  const docDigits = digitsOnly(cliente?.cpfCnpj);
  if (billingType === "PIX" && (!docDigits || (docDigits.length !== 11 && docDigits.length !== 14))) {
    return {
      success: false,
      error: "CPF ou CNPJ do cliente é obrigatório para cobranças PIX via Asaas.",
      errorCode: "MISSING_CPF",
    };
  }

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

  if (billingType === "CREDIT_CARD") {
    if (!creditCard || !creditCard.number || !creditCard.holderName || !creditCard.expiryMonth || !creditCard.expiryYear || !creditCard.ccv) {
      return {
        success: false,
        error: "Dados do cartão de crédito incompletos.",
        errorCode: "INVALID_CREDIT_CARD",
      };
    }

    const holder = creditCardHolderInfo || {};
    const holderCpf = digitsOnly(holder.cpfCnpj) || docDigits;
    if (!holderCpf || (holderCpf.length !== 11 && holderCpf.length !== 14)) {
      return {
        success: false,
        error: "CPF ou CNPJ do titular do cartão é obrigatório.",
        errorCode: "MISSING_HOLDER_CPF",
      };
    }

    paymentPayload.creditCard = {
      holderName: creditCard.holderName,
      number: digitsOnly(creditCard.number),
      expiryMonth: creditCard.expiryMonth,
      expiryYear: creditCard.expiryYear,
      ccv: creditCard.ccv,
    };

    paymentPayload.creditCardHolderInfo = {
      name: holder.name || cliente?.nome || creditCard.holderName,
      email: cleanEmail(holder.email) || cleanEmail(cliente?.email) || "cliente@lunarihub.com",
      cpfCnpj: holderCpf,
      postalCode: digitsOnly(holder.postalCode) || digitsOnly(cliente?.cep) || "",
      addressNumber: holder.addressNumber || cliente?.numero || "S/N",
      phone: normalizePhone(holder.phone) || normalizePhone(cliente?.whatsapp || cliente?.telefone) || "",
    };

    if (input.clientIp) {
      paymentPayload.remoteIp = input.clientIp;
    }

    // Validação de taxas server-side
    const baseValue = input.requestDadosExtras?.valorBase;
    if (baseValue && typeof baseValue === "number" && baseValue > 0) {
      const chargeOverrides = input.requestDadosExtras || {};
      const repassarTaxas = chargeOverrides.repassarTaxasProcessamento !== undefined
        ? chargeOverrides.repassarTaxasProcessamento
        : !settings.absorverTaxa;
        
      const ireiAntecipar = chargeOverrides.anteciparParcelas !== undefined
        ? chargeOverrides.anteciparParcelas
        : (settings.ireiAntecipar ?? (settings.incluirTaxaAntecipacao === true));
        
      const repassarAntecipacao = ireiAntecipar
        ? (chargeOverrides.repassarTaxaAntecipacao !== undefined ? chargeOverrides.repassarTaxaAntecipacao : (settings.repassarTaxaAntecipacao ?? (settings.incluirTaxaAntecipacao === true)))
        : false;
        
      try {
        const feesRes = await fetch(`${baseUrl}/v3/myAccount/fees`, {
          headers: { access_token: apiKey },
        });
        if (feesRes.ok) {
          const feesData = await feesRes.json();
          const normalizedFees = normalizeAsaasFees(feesData);
          const iCount = paymentPayload.installmentCount || 1;
          const { totalValue } = calculateCreditFees(
            baseValue,
            iCount,
            normalizedFees,
            repassarTaxas,
            repassarAntecipacao
          );
          
          // Se o valor cobrado diverge mais que R$ 1.00 (praxe pra arredondamento), rejeitamos
          if (valor < totalValue - 1) {
            console.error(`[asaas-adapter] Fraude/Divergência de valor: esperado ${totalValue}, recebido ${valor}`);
            return {
              success: false,
              error: "Divergência no cálculo de taxas. O valor cobrado é inválido.",
              errorCode: "FEE_MISMATCH",
            };
          }
        }
      } catch (feeErr) {
        console.warn("[asaas-adapter] Falha ao validar taxas no servidor:", feeErr);
      }
    }
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
  let pixQrCodeMissing = false;

  if (payData.billingType === "PIX") {
    const fetchQr = async (): Promise<{ ok: boolean; payload?: string; encodedImage?: string; error?: string }> => {
      try {
        const qrRes = await fetch(`${baseUrl}/v3/payments/${payData.id}/pixQrCode`, {
          headers: { access_token: apiKey },
        });
        if (qrRes.ok) {
          const qrData = await qrRes.json();
          if (qrData.payload || qrData.encodedImage) {
            return { ok: true, payload: qrData.payload, encodedImage: qrData.encodedImage };
          }
        } else {
          const errData = await qrRes.json().catch(() => null);
          return { ok: false, error: errData?.errors?.[0]?.description || `HTTP ${qrRes.status}` };
        }
      } catch (err: any) {
        return { ok: false, error: err?.message || "Network error" };
      }
      return { ok: false, error: "Empty QR code response" };
    };

    let qrResult = await fetchQr();
    if (!qrResult.ok) {
      // Retry com breve pausa caso o Asaas ainda esteja provisionando a chave
      await new Promise((resolve) => setTimeout(resolve, 800));
      qrResult = await fetchQr();
    }

    if (qrResult.ok) {
      pixCopiaCola = qrResult.payload;
      pixQrCodeBase64 = qrResult.encodedImage;
    } else {
      pixQrCodeMissing = true;
      console.warn(`[asaas-adapter] Falha não impeditiva ao buscar QR Code Pix para payment=${payData.id}:`, qrResult.error);
    }
  }

  return {
    success: true,
    providerOrderId: payData.id,
    checkoutUrl: payData.invoiceUrl || payData.bankSlipUrl || socialShareUrl,
    pixCopiaCola,
    pixQrCodeBase64,
    pixQrCodeMissing,
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
