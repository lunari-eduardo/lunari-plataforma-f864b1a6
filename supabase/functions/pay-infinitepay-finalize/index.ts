// supabase/functions/pay-infinitepay-finalize/index.ts
// Endpoint público chamado pelo checkout público para coletar dados do pagador,
// enriquecer CRM e emitir o link final na InfinitePay com os dados do cliente.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.2";
import { corsHeaders, jsonResponse, errorResponse } from "../_shared/auth-guard.ts";
import { enrichClienteIfMissing, type EnrichPatch } from "../_shared/enrich-cliente.ts";
import { resolvePayerHints } from "../_shared/payer-hints.ts";
import { createInfinitePayPayment } from "../_shared/adapters/infinitepay.ts";
import { AdapterCreatePaymentInput } from "../_shared/payment-types.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const PUBLIC_SITE_URL = (Deno.env.get("VITE_SITE_URL") || Deno.env.get("SITE_URL") || "https://app.lunarihub.com").replace(/\/$/, "");

interface FinalizeRequest {
  cobrancaId: string;
  payerPatch?: EnrichPatch & { nome?: string };
}

Deno.serve(async (req) => {
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
      .select("id, user_id, cliente_id, session_id, galeria_id, valor, descricao, status, provedor, ip_checkout_url, checkout_url")
      .eq("id", cobrancaId)
      .maybeSingle();

    if (cobError || !cobranca) return errorResponse("Cobrança não encontrada", 404);
    if (cobranca.provedor !== "infinitepay") return errorResponse("Cobrança não é InfinitePay", 400);
    if (cobranca.status === "pago") return jsonResponse({ success: false, error: "Cobrança já paga", code: "ALREADY_PAID" }, 400);

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
    const hints = await resolvePayerHints({
      supabase,
      clienteId: cobranca.cliente_id || null,
      galleryId: cobranca.galeria_id || null,
      sessionId: cobranca.session_id || null,
    });

    const clientNome = payerPatch?.nome || hints.name || "Cliente";
    const clientPhone = payerPatch?.telefone || hints.phone;
    const clientEmail = payerPatch?.email || hints.email;
    const clientDoc = payerPatch?.cpfCnpj || hints.cpfCnpj;

    // 4. Executar adaptador da InfinitePay
    const adapterPayload: AdapterCreatePaymentInput = {
      cobrancaId: cobranca.id,
      userId: cobranca.user_id,
      valor: Number(cobranca.valor),
      descricao: cobranca.descricao || "Serviço fotográfico",
      cliente: {
        id: cobranca.cliente_id || undefined,
        nome: clientNome,
        email: clientEmail,
        telefone: clientPhone,
        whatsapp: clientPhone,
        cpfCnpj: clientDoc,
        cep: hints.postalCode,
        endereco: hints.address,
        numero: hints.addressNumber,
        complemento: hints.complement,
        bairro: hints.province,
      },
      integrationData: {},
    };

    console.log(`[pay-infinitepay-finalize] Criando checkout InfinitePay para cobranca=${cobranca.id}`);

    const adapterData = await createInfinitePayPayment(supabase, adapterPayload, SUPABASE_URL, PUBLIC_SITE_URL);

    if (!adapterData.success || !adapterData.checkoutUrl) {
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
