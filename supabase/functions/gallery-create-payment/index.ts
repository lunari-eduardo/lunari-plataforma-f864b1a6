import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface CreatePaymentRequest {
  galleryId?: string;      // ID da galeria (para galerias avulsas)
  sessionId?: string;      // session_id texto (workflow-*) para galerias vinculadas
  clienteId: string;       // ID do cliente
  valor: number;           // Valor em reais
  descricao?: string;      // Descrição opcional
}

/**
 * Edge Function intermediária para o Gallery criar cobranças
 * 
 * Esta função permite que o Gallery crie cobranças usando o provedor de pagamento
 * configurado pelo fotógrafo, sem precisar do token JWT do fotógrafo.
 * 
 * Fluxo:
 * 1. Recebe galleryId ou sessionId
 * 2. Busca o user_id (fotógrafo) da galeria/sessão
 * 3. Busca o provedor ativo do fotógrafo
 * 4. Cria a cobrança usando Service Role
 * 5. Retorna URL de checkout
 */
serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Parse request body
    const body: CreatePaymentRequest = await req.json();
    const { galleryId, sessionId, clienteId, valor, descricao } = body;

    console.log("[gallery-create-payment] Request:", JSON.stringify({ galleryId, sessionId, clienteId, valor }));

    // Validar campos obrigatórios
    if (!clienteId) {
      throw new Error("clienteId é obrigatório");
    }
    if (!valor || valor <= 0) {
      throw new Error("valor deve ser maior que zero");
    }
    if (!galleryId && !sessionId) {
      throw new Error("galleryId ou sessionId é obrigatório");
    }

    // Buscar user_id (fotógrafo) da galeria ou sessão
    let photographerId: string | null = null;
    let finalSessionId: string | null = sessionId || null;

    if (galleryId) {
      // Buscar fotógrafo pela galeria
      const { data: galeria, error: galError } = await supabase
        .from("galerias")
        .select("user_id, session_id")
        .eq("id", galleryId)
        .single();

      if (galError || !galeria) {
        console.error("[gallery-create-payment] Gallery not found:", galError);
        throw new Error("Galeria não encontrada");
      }

      photographerId = galeria.user_id;
      finalSessionId = galeria.session_id || null;
      console.log("[gallery-create-payment] Found photographer from gallery:", photographerId);
    } else if (sessionId) {
      // Buscar fotógrafo pela sessão (tentar por session_id texto primeiro, depois por UUID)
      const { data: sessao, error: sessError } = await supabase
        .from("clientes_sessoes")
        .select("user_id, session_id")
        .or(`session_id.eq.${sessionId},id.eq.${sessionId}`)
        .maybeSingle();

      if (sessError || !sessao) {
        console.error("[gallery-create-payment] Session not found:", sessError);
        throw new Error("Sessão não encontrada");
      }

      photographerId = sessao.user_id;
      finalSessionId = sessao.session_id; // Sempre usar o formato texto
      console.log("[gallery-create-payment] Found photographer from session:", photographerId);
    }

    if (!photographerId) {
      throw new Error("Não foi possível identificar o fotógrafo");
    }

    // Buscar provedor de pagamento ativo do fotógrafo
    const { data: integracao, error: intError } = await supabase
      .from("usuarios_integracoes")
      .select("provedor, access_token, dados_extras, status")
      .eq("user_id", photographerId)
      .eq("status", "ativo")
      .in("provedor", ["mercadopago", "infinitepay"])
      .maybeSingle();

    if (intError) {
      console.error("[gallery-create-payment] Error fetching integration:", intError);
      throw new Error("Erro ao buscar configuração de pagamento");
    }

    if (!integracao) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Fotógrafo não tem provedor de pagamento configurado",
          errorCode: "NO_PAYMENT_PROVIDER",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[gallery-create-payment] Active provider:", integracao.provedor);

    // Buscar dados do cliente
    const { data: cliente, error: clienteError } = await supabase
      .from("clientes")
      .select("nome, email")
      .eq("id", clienteId)
      .single();

    if (clienteError || !cliente) {
      console.error("[gallery-create-payment] Client not found:", clienteError);
      throw new Error("Cliente não encontrado");
    }

    let checkoutUrl: string | null = null;
    let cobrancaId: string | null = null;

    // ===== INFINITEPAY =====
    if (integracao.provedor === "infinitepay") {
      const handle = integracao.dados_extras?.handle;
      if (!handle) {
        throw new Error("Handle InfinitePay não configurado");
      }

      // Criar registro de cobrança
      const { data: cobranca, error: cobError } = await supabase
        .from("cobrancas")
        .insert({
          user_id: photographerId,
          cliente_id: clienteId,
          session_id: finalSessionId,
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
        throw new Error("Erro ao criar registro de cobrança");
      }

      cobrancaId = cobranca.id;

      // Criar link InfinitePay
      const valorEmCentavos = Math.round(valor * 100);
      const webhookUrl = `${SUPABASE_URL}/functions/v1/infinitepay-webhook`;

      const ipPayload = {
        handle: handle,
        items: [
          {
            quantity: 1,
            price: valorEmCentavos,
            description: descricao || "Fotos extras - Galeria",
          },
        ],
        order_nsu: cobranca.id,
        webhook_url: webhookUrl,
      };

      console.log("[gallery-create-payment] Creating InfinitePay link:", JSON.stringify(ipPayload));

      const ipResponse = await fetch("https://api.infinitepay.io/invoices/public/checkout/links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(ipPayload),
      });

      if (!ipResponse.ok) {
        const errorText = await ipResponse.text();
        console.error("[gallery-create-payment] InfinitePay error:", errorText);
        await supabase.from("cobrancas").delete().eq("id", cobranca.id);
        throw new Error(`Erro na API InfinitePay: ${ipResponse.status}`);
      }

      const ipData = await ipResponse.json();
      checkoutUrl = ipData.checkout_url || ipData.url || ipData.link;

      if (!checkoutUrl) {
        await supabase.from("cobrancas").delete().eq("id", cobranca.id);
        throw new Error("URL de checkout não retornada pela InfinitePay");
      }

      // Atualizar cobrança com URL
      await supabase
        .from("cobrancas")
        .update({
          ip_checkout_url: checkoutUrl,
          ip_order_nsu: cobranca.id,
          mp_payment_link: checkoutUrl,
        })
        .eq("id", cobranca.id);

      console.log("[gallery-create-payment] InfinitePay checkout URL:", checkoutUrl);
    }

    // ===== MERCADO PAGO =====
    else if (integracao.provedor === "mercadopago") {
      const accessToken = integracao.access_token;
      if (!accessToken) {
        throw new Error("Token Mercado Pago não configurado");
      }

      // Criar preferência de pagamento
      const preferenceData = {
        items: [
          {
            title: descricao || `Cobrança - ${cliente.nome}`,
            quantity: 1,
            unit_price: Number(valor),
            currency_id: "BRL",
          },
        ],
        payer: {
          email: cliente.email || `cliente-${clienteId.substring(0, 8)}@example.com`,
          name: cliente.nome,
        },
        external_reference: `${photographerId}|${clienteId}|${finalSessionId || "avulso"}`,
        payment_methods: {
          installments: 12,
          excluded_payment_types: [],
        },
        expires: true,
        expiration_date_from: new Date().toISOString(),
        expiration_date_to: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      };

      console.log("[gallery-create-payment] Creating Mercado Pago preference");

      const mpResponse = await fetch("https://api.mercadopago.com/checkout/preferences", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(preferenceData),
      });

      const mpResult = await mpResponse.json();

      if (!mpResponse.ok) {
        console.error("[gallery-create-payment] Mercado Pago error:", mpResult);
        throw new Error(mpResult.message || "Falha ao criar link de pagamento");
      }

      checkoutUrl = mpResult.init_point;

      // Salvar cobrança
      const { data: cobranca, error: insertError } = await supabase
        .from("cobrancas")
        .insert({
          user_id: photographerId,
          cliente_id: clienteId,
          session_id: finalSessionId,
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
        throw new Error("Falha ao salvar cobrança");
      }

      cobrancaId = cobranca.id;
      console.log("[gallery-create-payment] Mercado Pago checkout URL:", checkoutUrl);
    }

    // Retornar sucesso
    return new Response(
      JSON.stringify({
        success: true,
        checkoutUrl: checkoutUrl,
        cobrancaId: cobrancaId,
        provedor: integracao.provedor,
        sessionId: finalSessionId,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("[gallery-create-payment] Error:", error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Erro desconhecido",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      }
    );
  }
});
