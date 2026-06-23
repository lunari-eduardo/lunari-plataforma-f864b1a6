import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// =============================================================================
// gallery-create-payment · Onda A
// -----------------------------------------------------------------------------
// Edge function consumida pelo projeto Lunari Gallery para criar cobranças no
// provedor de pagamento configurado pelo fotógrafo, sem precisar do JWT dele.
//
// Onda A traz:
//   1. Gate de autorização server-side via `public.user_has_gallery_access()`.
//   2. Suporte ao provedor Asaas (além de InfinitePay e Mercado Pago).
//   3. Seleção de provedor respeitando a coluna `is_default`.
//   4. Idempotência: requisições repetidas (mesmo fotógrafo + cliente + sessão
//      + valor + provedor) em até 10 minutos reaproveitam a cobrança pendente.
// =============================================================================

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const IDEMPOTENCY_WINDOW_MIN = 10;
const SUPPORTED_PROVIDERS = ["asaas", "mercadopago", "infinitepay"] as const;
type Provider = (typeof SUPPORTED_PROVIDERS)[number];

interface CreatePaymentRequest {
  galleryId?: string;
  sessionId?: string;
  clienteId: string;
  valor: number;
  descricao?: string;
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const body: CreatePaymentRequest = await req.json();
    const { galleryId, sessionId, clienteId, valor, descricao } = body;

    console.log("[gallery-create-payment] Request:", JSON.stringify({ galleryId, sessionId, clienteId, valor }));

    // ----- Validação de entrada ---------------------------------------------
    if (!clienteId) return jsonResponse({ success: false, error: "clienteId é obrigatório" }, 400);
    if (!valor || valor <= 0) return jsonResponse({ success: false, error: "valor deve ser maior que zero" }, 400);
    if (!galleryId && !sessionId) {
      return jsonResponse({ success: false, error: "galleryId ou sessionId é obrigatório" }, 400);
    }

    // ----- Resolver fotógrafo (dono da galeria/sessão) ----------------------
    let photographerId: string | null = null;
    let finalSessionId: string | null = sessionId || null;
    let finalGalleryId: string | null = galleryId || null;

    if (galleryId) {
      const { data: galeria, error: galError } = await supabase
        .from("galerias")
        .select("user_id, session_id")
        .eq("id", galleryId)
        .maybeSingle();

      if (galError || !galeria) {
        console.error("[gallery-create-payment] Gallery not found:", galError);
        return jsonResponse({ success: false, error: "Galeria não encontrada" }, 404);
      }
      photographerId = galeria.user_id;
      finalSessionId = galeria.session_id || finalSessionId;
    } else if (sessionId) {
      const { data: sessao, error: sessError } = await supabase
        .from("clientes_sessoes")
        .select("user_id, session_id")
        .or(`session_id.eq.${sessionId},id.eq.${sessionId}`)
        .maybeSingle();

      if (sessError || !sessao) {
        console.error("[gallery-create-payment] Session not found:", sessError);
        return jsonResponse({ success: false, error: "Sessão não encontrada" }, 404);
      }
      photographerId = sessao.user_id;
      finalSessionId = sessao.session_id;
    }

    if (!photographerId) {
      return jsonResponse({ success: false, error: "Não foi possível identificar o fotógrafo" }, 404);
    }

    // ----- GATE: autorização Gallery server-side ----------------------------
    const { data: accessData, error: accessError } = await supabase.rpc(
      "user_has_gallery_access",
      { _user_id: photographerId },
    );

    if (accessError) {
      console.error("[gallery-create-payment] user_has_gallery_access error:", accessError);
      return jsonResponse({ success: false, error: "Falha ao validar acesso Gallery" }, 500);
    }

    if (!accessData) {
      console.warn("[gallery-create-payment] Photographer without Gallery access:", photographerId);
      return jsonResponse({
        success: false,
        error: "O fotógrafo não possui plano ativo com integração Gallery.",
        errorCode: "NO_GALLERY_ACCESS",
      }, 403);
    }

    // ----- Provedor de pagamento ativo (respeita is_default) ----------------
    const { data: integracao, error: intError } = await supabase
      .from("usuarios_integracoes")
      .select("provedor, access_token, dados_extras, status, is_default, updated_at")
      .eq("user_id", photographerId)
      .eq("status", "ativo")
      .in("provedor", SUPPORTED_PROVIDERS as unknown as string[])
      .order("is_default", { ascending: false })
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (intError) {
      console.error("[gallery-create-payment] Error fetching integration:", intError);
      return jsonResponse({ success: false, error: "Erro ao buscar configuração de pagamento" }, 500);
    }

    if (!integracao) {
      return jsonResponse({
        success: false,
        error: "Fotógrafo não tem provedor de pagamento configurado",
        errorCode: "NO_PAYMENT_PROVIDER",
      }, 400);
    }

    const provedor = integracao.provedor as Provider;
    console.log("[gallery-create-payment] Active provider:", provedor, "is_default=", integracao.is_default);

    // ----- Idempotência: reaproveita cobrança pendente recente --------------
    const since = new Date(Date.now() - IDEMPOTENCY_WINDOW_MIN * 60 * 1000).toISOString();
    const dedupQuery = supabase
      .from("cobrancas")
      .select("id, mp_payment_link, ip_checkout_url, provedor")
      .eq("user_id", photographerId)
      .eq("cliente_id", clienteId)
      .eq("provedor", provedor)
      .eq("valor", Number(valor))
      .eq("status", "pendente")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(1);

    if (finalSessionId) dedupQuery.eq("session_id", finalSessionId);
    else dedupQuery.is("session_id", null);

    const { data: existing } = await dedupQuery.maybeSingle();
    if (existing) {
      const url = existing.ip_checkout_url || existing.mp_payment_link;
      if (url) {
        console.log("[gallery-create-payment] Idempotent reuse:", existing.id);
        return jsonResponse({
          success: true,
          checkoutUrl: url,
          cobrancaId: existing.id,
          provedor: existing.provedor,
          sessionId: finalSessionId,
          reused: true,
        });
      }
    }

    // ----- Cliente ----------------------------------------------------------
    const { data: cliente, error: clienteError } = await supabase
      .from("clientes")
      .select("nome, email, telefone, whatsapp")
      .eq("id", clienteId)
      .maybeSingle();

    if (clienteError || !cliente) {
      console.error("[gallery-create-payment] Client not found:", clienteError);
      return jsonResponse({ success: false, error: "Cliente não encontrado" }, 404);
    }

    let checkoutUrl: string | null = null;
    let cobrancaId: string | null = null;

    // =====================================================================
    // INFINITEPAY
    // =====================================================================
    if (provedor === "infinitepay") {
      const handle = (integracao.dados_extras as any)?.handle;
      if (!handle) return jsonResponse({ success: false, error: "Handle InfinitePay não configurado" }, 400);

      const { data: cobranca, error: cobError } = await supabase
        .from("cobrancas")
        .insert({
          user_id: photographerId,
          cliente_id: clienteId,
          session_id: finalSessionId,
          galeria_id: finalGalleryId,
          valor: valor,
          descricao: descricao || "Pagamento via Galeria",
          tipo_cobranca: "link",
          provedor: "infinitepay",
          status: "pendente",
        })
        .select()
        .single();

      if (cobError || !cobranca) {
        console.error("[gallery-create-payment] Error creating cobranca:", cobError);
        return jsonResponse({ success: false, error: "Erro ao criar registro de cobrança" }, 500);
      }
      cobrancaId = cobranca.id;

      const ipPayload = {
        handle,
        items: [{
          quantity: 1,
          price: Math.round(valor * 100),
          description: descricao || "Fotos extras - Galeria",
        }],
        order_nsu: cobranca.id,
        webhook_url: `${SUPABASE_URL}/functions/v1/infinitepay-webhook`,
      };

      const ipResponse = await fetch("https://api.checkout.infinitepay.io/links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(ipPayload),
      });

      if (!ipResponse.ok) {
        const errorText = await ipResponse.text();
        console.error("[gallery-create-payment] InfinitePay error:", errorText);
        await supabase.from("cobrancas").delete().eq("id", cobranca.id);
        return jsonResponse({ success: false, error: `Erro na API InfinitePay: ${ipResponse.status}` }, 502);
      }

      const ipData = await ipResponse.json();
      checkoutUrl = ipData.checkout_url || ipData.url || ipData.link;
      if (!checkoutUrl) {
        await supabase.from("cobrancas").delete().eq("id", cobranca.id);
        return jsonResponse({ success: false, error: "URL de checkout não retornada pela InfinitePay" }, 502);
      }

      await supabase.from("cobrancas").update({
        ip_checkout_url: checkoutUrl,
        ip_order_nsu: cobranca.id,
        mp_payment_link: checkoutUrl,
      }).eq("id", cobranca.id);
    }

    // =====================================================================
    // MERCADO PAGO
    // =====================================================================
    else if (provedor === "mercadopago") {
      const accessToken = integracao.access_token;
      if (!accessToken) return jsonResponse({ success: false, error: "Token Mercado Pago não configurado" }, 400);

      const preferenceData = {
        items: [{
          title: descricao || `Cobrança - ${cliente.nome}`,
          quantity: 1,
          unit_price: Number(valor),
          currency_id: "BRL",
        }],
        payer: {
          email: cliente.email || `cliente-${clienteId.substring(0, 8)}@example.com`,
          name: cliente.nome,
        },
        external_reference: `${photographerId}|${clienteId}|${finalSessionId || "avulso"}`,
        notification_url: `${SUPABASE_URL}/functions/v1/mercadopago-webhook`,
        payment_methods: { installments: 12, excluded_payment_types: [] },
        expires: true,
        expiration_date_from: new Date().toISOString(),
        expiration_date_to: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      };

      const mpResponse = await fetch("https://api.mercadopago.com/checkout/preferences", {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify(preferenceData),
      });
      const mpResult = await mpResponse.json();

      if (!mpResponse.ok) {
        console.error("[gallery-create-payment] Mercado Pago error:", mpResult);
        return jsonResponse({ success: false, error: mpResult.message || "Falha ao criar link de pagamento" }, 502);
      }

      checkoutUrl = mpResult.init_point;

      const { data: cobranca, error: insertError } = await supabase
        .from("cobrancas")
        .insert({
          user_id: photographerId,
          cliente_id: clienteId,
          session_id: finalSessionId,
          galeria_id: finalGalleryId,
          valor: Number(valor),
          descricao: descricao || `Pagamento via Galeria - ${cliente.nome}`,
          tipo_cobranca: "link",
          provedor: "mercadopago",
          status: "pendente",
          mp_preference_id: mpResult.id,
          mp_payment_link: mpResult.init_point,
          mp_expiration_date: preferenceData.expiration_date_to,
        })
        .select()
        .single();

      if (insertError) {
        console.error("[gallery-create-payment] Error saving cobranca:", insertError);
        return jsonResponse({ success: false, error: "Falha ao salvar cobrança" }, 500);
      }
      cobrancaId = cobranca.id;
    }

    // =====================================================================
    // ASAAS (novo em Onda A)
    // =====================================================================
    else if (provedor === "asaas") {
      const asaasApiKey = integracao.access_token;
      if (!asaasApiKey) return jsonResponse({ success: false, error: "Token Asaas não configurado" }, 400);

      const settings = (integracao.dados_extras || {}) as { environment?: string };
      const asaasBaseUrl = settings.environment === "production"
        ? "https://api.asaas.com"
        : "https://api-sandbox.asaas.com";

      // 1) Buscar/criar customer no Asaas
      let asaasCustomerId: string | null = null;
      if (cliente.email) {
        const searchResp = await fetch(
          `${asaasBaseUrl}/v3/customers?email=${encodeURIComponent(cliente.email)}`,
          { headers: { access_token: asaasApiKey } },
        );
        if (searchResp.ok) {
          const searchData = await searchResp.json();
          if (searchData.data?.length > 0) asaasCustomerId = searchData.data[0].id;
        }
      }

      if (!asaasCustomerId) {
        const createResp = await fetch(`${asaasBaseUrl}/v3/customers`, {
          method: "POST",
          headers: { "Content-Type": "application/json", access_token: asaasApiKey },
          body: JSON.stringify({
            name: cliente.nome || "Cliente",
            email: cliente.email || undefined,
            phone: cliente.whatsapp || cliente.telefone || undefined,
            externalReference: clienteId,
          }),
        });
        if (!createResp.ok) {
          const errData = await createResp.json().catch(() => ({}));
          console.error("[gallery-create-payment] Asaas customer error:", errData);
          return jsonResponse({ success: false, error: "Erro ao criar cliente no Asaas" }, 502);
        }
        asaasCustomerId = (await createResp.json()).id;
      }

      // 2) Criar cobrança UNDEFINED (cliente escolhe forma de pagamento)
      const dueDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      const externalReference = `gallery|${photographerId}|${clienteId}|${finalSessionId || "avulso"}`;

      const paymentResp = await fetch(`${asaasBaseUrl}/v3/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json", access_token: asaasApiKey },
        body: JSON.stringify({
          customer: asaasCustomerId,
          billingType: "UNDEFINED",
          value: Number(valor),
          dueDate,
          description: descricao || `Pagamento via Galeria - ${cliente.nome}`,
          externalReference,
        }),
      });

      if (!paymentResp.ok) {
        const errData = await paymentResp.json().catch(() => ({}));
        console.error("[gallery-create-payment] Asaas payment error:", errData);
        return jsonResponse({ success: false, error: "Falha ao criar cobrança no Asaas" }, 502);
      }

      const asaasPayment = await paymentResp.json();
      checkoutUrl = asaasPayment.invoiceUrl || asaasPayment.bankSlipUrl;

      if (!checkoutUrl) {
        return jsonResponse({ success: false, error: "URL de checkout não retornada pelo Asaas" }, 502);
      }

      const { data: cobranca, error: insertError } = await supabase
        .from("cobrancas")
        .insert({
          user_id: photographerId,
          cliente_id: clienteId,
          session_id: finalSessionId,
          galeria_id: finalGalleryId,
          valor: Number(valor),
          descricao: descricao || `Pagamento via Galeria - ${cliente.nome}`,
          tipo_cobranca: "link",
          provedor: "asaas",
          status: "pendente",
          asaas_payment_id: asaasPayment.id,
          asaas_customer_id: asaasCustomerId,
          asaas_invoice_url: checkoutUrl,
          mp_payment_link: checkoutUrl,
        })
        .select()
        .single();

      if (insertError) {
        console.error("[gallery-create-payment] Error saving Asaas cobranca:", insertError);
        return jsonResponse({ success: false, error: "Falha ao salvar cobrança" }, 500);
      }
      cobrancaId = cobranca.id;
    }

    return jsonResponse({
      success: true,
      checkoutUrl,
      cobrancaId,
      provedor,
      sessionId: finalSessionId,
    });
  } catch (error) {
    console.error("[gallery-create-payment] Unexpected error:", error);
    return jsonResponse({
      success: false,
      error: error instanceof Error ? error.message : "Erro desconhecido",
    }, 500);
  }
});
