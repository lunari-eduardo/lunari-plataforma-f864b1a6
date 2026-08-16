// supabase/functions/pay-infinitepay-finalize/index.ts
// Endpoint público chamado pela página /pay/ip/:cobrancaId para coletar dados do pagador,
// enriquecer CRM e delegar a criação do link InfinitePay ao adaptador oficial.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.2";
import { corsHeaders, jsonResponse, errorResponse } from "../_shared/auth-guard.ts";
import { enrichClienteIfMissing, type EnrichPatch } from "../_shared/enrich-cliente.ts";
import { resolvePayerHints } from "../_shared/payer-hints.ts";
import { AdapterCreatePaymentInput, AdapterCreatePaymentOutput } from "../_shared/payment-types.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const PUBLIC_SITE_URL = (Deno.env.get("VITE_SITE_URL") || Deno.env.get("SITE_URL") || "https://app.lunarihub.com").replace(/\/$/, "");

interface FinalizeRequest {
  cobrancaId: string;
  payerPatch?: EnrichPatch & { nome?: string };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body: FinalizeRequest = await req.json();
    const { cobrancaId, payerPatch } = body;
    if (!cobrancaId) return errorResponse("cobrancaId é obrigatório", 400);

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // 1. Carregar cobrança
    const { data: cobranca, error: cobError } = await supabase
      .from("cobrancas")
      .select("id, user_id, cliente_id, valor, descricao, status, provedor, ip_checkout_url, checkout_url")
      .eq("id", cobrancaId)
      .maybeSingle();

    if (cobError || !cobranca) return errorResponse("Cobrança não encontrada", 404);
    if (cobranca.provedor !== "infinitepay") return errorResponse("Cobrança não é InfinitePay", 400);
    if (cobranca.status === "pago") return jsonResponse({ success: false, error: "Cobrança já paga", code: "ALREADY_PAID" }, 400);

    // Se já possui link definitivo na InfinitePay, reaproveita
    const existingUrl = cobranca.checkout_url || cobranca.ip_checkout_url;
    if (existingUrl && !existingUrl.startsWith(PUBLIC_SITE_URL) && existingUrl.includes("infinitepay")) {
      return jsonResponse({ success: true, checkoutUrl: existingUrl, reused: true });
    }

    // 2. Enriquecimento do CRM
    if (payerPatch && cobranca.cliente_id) {
      const { nome, ...rest } = payerPatch;
      await enrichClienteIfMissing(supabase, cobranca.cliente_id, rest);

      if (nome && nome.trim().length >= 2) {
        const { data: c } = await supabase
          .from("clientes")
          .select("nome")
          .eq("id", cobranca.cliente_id)
          .maybeSingle();

        if (c && (!c.nome || (c.nome as string).trim() === "")) {
          await supabase.from("clientes").update({ nome: nome.trim() }).eq("id", cobranca.cliente_id);
        }
      }
    }

    // 3. Resolver hints consolidados
    const hints = cobranca.cliente_id
      ? await resolvePayerHints({ supabase, clienteId: cobranca.cliente_id })
      : {};

    if (!hints.name) return errorResponse("Nome do pagador é obrigatório", 400, "MISSING_NAME");
    if (!hints.phone) return errorResponse("Telefone do pagador é obrigatório", 400, "MISSING_PHONE");

    // 4. Delegar criação para o adaptador create-infinitepay-payment
    const adapterUrl = `${SUPABASE_URL}/functions/v1/create-infinitepay-payment`;
    const adapterPayload: AdapterCreatePaymentInput = {
      cobrancaId: cobranca.id,
      userId: cobranca.user_id,
      valor: Number(cobranca.valor),
      descricao: cobranca.descricao || "Serviço fotográfico",
      cliente: {
        id: cobranca.cliente_id || undefined,
        nome: hints.name,
        email: hints.email,
        telefone: hints.phone,
        whatsapp: hints.phone,
        cpfCnpj: hints.document,
        cep: hints.postalCode,
        endereco: hints.address,
        numero: hints.addressNumber,
        complemento: hints.complement,
        bairro: hints.province,
      },
      integrationData: {},
    };

    console.log(`[pay-infinitepay-finalize] Invocando create-infinitepay-payment para cobranca=${cobranca.id}`);

    const adapterRes = await fetch(adapterUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
        "x-lunari-internal-caller": "pay-infinitepay-finalize",
      },
      body: JSON.stringify(adapterPayload),
    });

    const adapterData: AdapterCreatePaymentOutput = await adapterRes.json();

    if (!adapterRes.ok || !adapterData.success || !adapterData.checkoutUrl) {
      console.error("[pay-infinitepay-finalize] Adaptador retornou erro:", adapterData);
      return jsonResponse({
        success: false,
        error: adapterData.error || "Falha ao gerar link na InfinitePay",
        code: adapterData.errorCode || "IP_API_ERROR",
      }, 502);
    }

    // 5. Atualizar cobrança com a URL definitiva
    await supabase
      .from("cobrancas")
      .update({
        checkout_url: adapterData.checkoutUrl,
        ip_checkout_url: adapterData.checkoutUrl,
        provider_order_id: adapterData.providerOrderId || null,
        ip_order_nsu: cobranca.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", cobranca.id);

    console.log(`[pay-infinitepay-finalize] Sucesso: checkoutUrl=${adapterData.checkoutUrl}`);

    return jsonResponse({ success: true, checkoutUrl: adapterData.checkoutUrl }, 200);
  } catch (err: any) {
    console.error("[pay-infinitepay-finalize] Erro inesperado:", err);
    return errorResponse(err.message || "Erro interno ao finalizar pagamento", 500);
  }
});
