// supabase/functions/create-asaas-payment/index.ts
// Adaptador técnico para a API do Asaas (Service Role Only)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.2";
import { requireServiceRole, corsHeaders, jsonResponse, errorResponse } from "../_shared/auth-guard.ts";
import { AdapterCreatePaymentInput, AdapterCreatePaymentOutput } from "../_shared/payment-types.ts";
import { putAsaasCustomer } from "../_shared/asaas-helpers.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

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

async function ensureAsaasCustomer(
  baseUrl: string,
  apiKey: string,
  cliente: any
): Promise<{ customerId: string; error?: string }> {
  const doc = digitsOnly(cliente?.cpfCnpj);
  const email = cleanEmail(cliente?.email);
  const phone = normalizePhone(cliente?.whatsapp || cliente?.telefone);
  const name = cliente?.nome?.trim() || "Cliente Lunari";
  
  let existingCustomer: any = null;

  // 1. Tentar localizar cliente existente por CPF/CNPJ ou Email
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
    // Se o cliente existe, mas não tem o cpfCnpj preenchido no Asaas, atualiza
    if (doc && (!existingCustomer.cpfCnpj || digitsOnly(existingCustomer.cpfCnpj) !== doc)) {
      await putAsaasCustomer(baseUrl, apiKey, existingCustomer.id, {
        cpfCnpj: doc,
        name: existingCustomer.name || name,
        mobilePhone: existingCustomer.mobilePhone || phone,
      });
    }
    return { customerId: existingCustomer.id };
  }

  // 2. Criar novo cliente no Asaas
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
      console.error("[create-asaas-payment] Falha ao criar cliente no Asaas (retry sem email):", retryData);
      return { customerId: "", error: retryData.errors?.[0]?.description || "Erro ao registrar cliente no Asaas" };
    }
    
    console.error("[create-asaas-payment] Falha ao criar cliente no Asaas:", createData);
    return { customerId: "", error: createData.errors?.[0]?.description || "Erro ao registrar cliente no Asaas" };
  }

  return { customerId: createData.id };
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
    const {
      cobrancaId,
      userId,
      valor,
      descricao,
      cliente,
      billingType = "PIX",
      creditCard,
      creditCardHolderInfo,
      installmentCount,
      integrationData,
    } = body;

    if (!cobrancaId || !userId || !valor || valor <= 0) {
      return errorResponse("cobrancaId, userId e valor (>0) são obrigatórios", 400);
    }

    // 1. Obter API Key e configurações do Asaas
    let apiKey = integrationData?.accessToken;
    let dadosExtras = integrationData?.dadosExtras;

    if (!apiKey) {
      const { data: integ, error: integErr } = await supabase
        .from("usuarios_integracoes")
        .select("access_token, dados_extras")
        .eq("user_id", userId)
        .eq("provedor", "asaas")
        .eq("status", "ativo")
        .maybeSingle();

      if (integErr || !integ?.access_token) {
        return errorResponse("Integração Asaas não configurada ou inativa para este fotógrafo", 400, "ASAAS_NOT_CONFIGURED");
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

    // 2. Garantir cliente no Asaas
    const { customerId, error: custErr } = await ensureAsaasCustomer(baseUrl, apiKey, cliente);
    if (custErr || !customerId) {
      return jsonResponse({
        success: false,
        error: custErr || "Falha ao vincular cliente no Asaas",
        errorCode: "ASAAS_CUSTOMER_ERROR",
      } as AdapterCreatePaymentOutput, 400);
    }

    // 3. Montar payload do pagamento
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    const installments = installmentCount && installmentCount > 1 ? installmentCount : undefined;

    const paymentPayload: Record<string, any> = {
      customer: customerId,
      billingType: billingType === "UNDEFINED" ? "UNDEFINED" : (billingType || "PIX"),
      value: Math.round(Number(valor) * 100) / 100,
      dueDate: tomorrow,
      description: descricao || "Serviço fotográfico",
      externalReference: cobrancaId,
    };

    // Parcelamento no Asaas
    if (installments && installments > 1) {
      paymentPayload.installmentCount = installments;
      paymentPayload.installmentValue = Math.round((valor / installments) * 100) / 100;
    }

    // Dados de cartão de crédito para processamento transparente
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

    console.log(`[create-asaas-payment] Criando cobrança no Asaas para cobranca=${cobrancaId}, billingType=${paymentPayload.billingType}, valor=${valor}`);

    // 4. Criar pagamento no Asaas
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
      console.error("[create-asaas-payment] Erro na resposta do Asaas:", payData);
      return jsonResponse({
        success: false,
        error: payData.errors?.[0]?.description || "Erro ao processar pagamento no Asaas",
        errorCode: "ASAAS_API_ERROR",
        details: payData,
      } as AdapterCreatePaymentOutput, 400);
    }

    // 5. Se for PIX, buscar payload e QR Code
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
        console.warn("[create-asaas-payment] Falha não impeditiva ao buscar QR Code Pix:", qrErr);
      }
    }

    const output: AdapterCreatePaymentOutput = {
      success: true,
      providerOrderId: payData.id,
      checkoutUrl: payData.invoiceUrl || payData.bankSlipUrl,
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

    return jsonResponse(output, 200);
  } catch (err: any) {
    console.error("[create-asaas-payment] Exceção inesperada:", err);
    return errorResponse(err.message || "Falha ao processar criação de pagamento no Asaas", 500);
  }
});
