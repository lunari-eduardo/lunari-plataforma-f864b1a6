// supabase/functions/create-infinitepay-payment/index.ts
// Adaptador técnico para a API de Checkout Links da InfinitePay (Service Role Only)

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

function normalizePhone(v?: string | null): string | undefined {
  if (!v) return undefined;
  const digits = v.replace(/\D/g, "");
  const local = digits.startsWith("55") && (digits.length === 12 || digits.length === 13) ? digits.slice(2) : digits;
  return local.length === 10 || local.length === 11 ? local : undefined;
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

    // 1. Obter handle da InfinitePay
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
        return errorResponse("Handle InfinitePay não configurado ou inativo para este fotógrafo", 400, "IP_NOT_CONFIGURED");
      }

      handle = integ.dados_extras.handle;
    }

    const cleanHandle = String(handle).replace(/^@/, "").trim();
    if (!cleanHandle) {
      return errorResponse("Handle InfinitePay inválido", 400, "INVALID_HANDLE");
    }

    // 2. Montar dados do pagador
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

    // 3. Montar payload InfinitePay
    const valorEmCentavos = Math.round(Number(valor) * 100);
    const webhookUrl = `${SUPABASE_URL}/functions/v1/infinitepay-webhook`;
    const redirectUrl = `${PUBLIC_SITE_URL}/l/${cobrancaId}`;

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

    // Endereço somente quando completo
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

    console.log(`[create-infinitepay-payment] Criando link InfinitePay para cobranca=${cobrancaId}, handle=${cleanHandle}, valorEmCentavos=${valorEmCentavos}`);

    // 4. Chamar API da InfinitePay
    const ipRes = await fetch("https://api.checkout.infinitepay.io/links", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const ipData = await ipRes.json();

    if (!ipRes.ok || (!ipData.url && !ipData.checkout_url)) {
      console.error("[create-infinitepay-payment] Erro na resposta da InfinitePay:", ipData);
      return jsonResponse({
        success: false,
        error: ipData.message || ipData.error || "Erro ao gerar link de pagamento na InfinitePay",
        errorCode: "IP_API_ERROR",
        details: ipData,
      } as AdapterCreatePaymentOutput, 400);
    }

    const finalUrl = ipData.url || ipData.checkout_url;
    const slug = ipData.slug || ipData.id || cobrancaId;

    const output: AdapterCreatePaymentOutput = {
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

    return jsonResponse(output, 200);
  } catch (err: any) {
    console.error("[create-infinitepay-payment] Exceção inesperada:", err);
    return errorResponse(err.message || "Falha ao processar criação de link na InfinitePay", 500);
  }
});
