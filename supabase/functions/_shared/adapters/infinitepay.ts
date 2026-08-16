// supabase/functions/_shared/adapters/infinitepay.ts
// Adaptador direto da InfinitePay para o create-cobranca

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.2";
import { AdapterCreatePaymentInput, AdapterCreatePaymentOutput } from "../payment-types.ts";

function cleanEmail(v?: string | null): string | undefined {
  if (!v) return undefined;
  const email = v.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : undefined;
}

function normalizePhone(v?: string | null): string | undefined {
  if (!v) return undefined;
  const digits = v.replace(/\D/g, "");
  const local = digits.startsWith("55") && (digits.length === 12 || digits.length === 13) ? digits.slice(2) : digits;
  return local.length === 10 || local.length === 11 ? local : undefined;
}

export async function createInfinitePayPayment(
  supabase: SupabaseClient,
  input: AdapterCreatePaymentInput,
  supabaseUrl: string,
  publicSiteUrl: string
): Promise<AdapterCreatePaymentOutput> {
  const { cobrancaId, userId, valor, descricao, cliente, integrationData } = input;

  let handle = integrationData?.dadosExtras?.handle;

  if (!handle) {
    const { data: integ, error: integErr } = await supabase
      .from("usuarios_integracoes")
      .select("dados_extras")
      .eq("user_id", userId)
      .eq("provedor", "infinitepay")
      .eq("status", "ativo")
      .maybeSingle();

    if (integErr || !integ?.dados_extras?.handle) {
      return {
        success: false,
        error: "Handle InfinitePay não configurado ou inativo para este fotógrafo",
        errorCode: "IP_NOT_CONFIGURED",
      };
    }

    handle = integ.dados_extras.handle;
  }

  const cleanHandle = String(handle).replace(/^@/, "").trim();
  if (!cleanHandle) {
    return {
      success: false,
      error: "Handle InfinitePay inválido",
      errorCode: "INVALID_HANDLE",
    };
  }

  const clientPhone = normalizePhone(cliente?.whatsapp || cliente?.telefone);
  const customerPayload: Record<string, string> = {
    name: cliente?.nome?.trim() || "Cliente",
  };

  if (clientPhone) {
    customerPayload.phone_number = `+55${clientPhone}`;
  }

  const validEmail = cleanEmail(cliente?.email);
  if (validEmail) {
    customerPayload.email = validEmail;
  }

  const valorEmCentavos = Math.round(Number(valor) * 100);
  const webhookUrl = `${supabaseUrl}/functions/v1/infinitepay-webhook`;
  const redirectUrl = `${publicSiteUrl}/l/${cobrancaId}`;

  const payload: Record<string, unknown> = {
    handle: cleanHandle,
    items: [
      {
        quantity: 1,
        price: valorEmCentavos,
        description: descricao || "Serviço fotográfico",
      },
    ],
    order_nsu: cobrancaId,
    webhook_url: webhookUrl,
    redirect_url: redirectUrl,
    customer: customerPayload,
  };

  if (cliente?.cep && cliente?.endereco && cliente?.numero) {
    const address: Record<string, string> = {
      cep: cliente.cep.replace(/\D/g, ""),
      street: cliente.endereco,
      number: cliente.numero,
    };
    if (cliente.bairro) address.neighborhood = cliente.bairro;
    if (cliente.complemento) address.complement = cliente.complemento;
    payload.address = address;
  }

  console.log(`[infinitepay-adapter] Criando link InfinitePay para cobranca=${cobrancaId}, handle=${cleanHandle}, valorEmCentavos=${valorEmCentavos}`);

  const ipRes = await fetch("https://api.checkout.infinitepay.io/links", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const ipData = await ipRes.json();

  if (!ipRes.ok || (!ipData.url && !ipData.checkout_url)) {
    console.error("[infinitepay-adapter] Erro na resposta da InfinitePay:", ipData);
    return {
      success: false,
      error: ipData.message || ipData.error || "Erro ao gerar link de pagamento na InfinitePay",
      errorCode: "IP_API_ERROR",
    };
  }

  const finalUrl = ipData.url || ipData.checkout_url;
  const slug = ipData.slug || ipData.id || cobrancaId;

  return {
    success: true,
    providerOrderId: slug,
    checkoutUrl: finalUrl,
    dadosExtras: {
      slug,
      url: finalUrl,
      handle: cleanHandle,
      orderNsu: cobrancaId,
      invoiceSlug: ipData.invoice_slug || slug,
    },
  };
}
