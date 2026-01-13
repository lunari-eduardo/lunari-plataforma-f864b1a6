import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const INFINITEPAY_API_URL = "https://api.infinitepay.io/invoices/public/checkout/links";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface CreateLinkRequest {
  clienteId: string;
  sessionId?: string;
  valor: number;
  descricao?: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get auth user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Não autorizado");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    // Validate JWT and get user
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      throw new Error("Usuário não autenticado");
    }

    const userId = user.id;

    // Parse request body
    const { clienteId, sessionId, valor, descricao }: CreateLinkRequest = await req.json();

    if (!clienteId || !valor) {
      throw new Error("clienteId e valor são obrigatórios");
    }

    console.log(`[infinitepay-create-link] Creating link for user ${userId}, cliente ${clienteId}, valor ${valor}`);

    // Get user's InfinitePay handle from usuarios_integracoes (multi-tenant)
    const { data: integracao, error: intError } = await supabase
      .from("usuarios_integracoes")
      .select("dados_extras")
      .eq("user_id", userId)
      .eq("provedor", "infinitepay")
      .eq("status", "ativo")
      .single();

    if (intError || !integracao) {
      throw new Error("InfinitePay não configurado. Configure seu handle em Integrações.");
    }

    const handle = integracao.dados_extras?.handle;
    if (!handle) {
      throw new Error("Handle InfinitePay não encontrado");
    }

    // NORMALIZE session_id: buscar o session_id TEXTO correto da tabela
    let normalizedSessionId: string | null = null;
    if (sessionId) {
      const { data: sessaoData } = await supabase
        .from("clientes_sessoes")
        .select("session_id")
        .or(`id.eq.${sessionId},session_id.eq.${sessionId}`)
        .maybeSingle();
      
      if (sessaoData?.session_id) {
        normalizedSessionId = sessaoData.session_id;
        console.log(`[infinitepay-create-link] Normalized session_id: ${sessionId} -> ${normalizedSessionId}`);
      } else {
        // Se não encontrar, usar o sessionId original
        normalizedSessionId = sessionId;
        console.log(`[infinitepay-create-link] Session not found, using original: ${sessionId}`);
      }
    }

    // Create cobranca record first to get ID for order_nsu
    const { data: cobranca, error: cobError } = await supabase
      .from("cobrancas")
      .insert({
        user_id: userId,
        cliente_id: clienteId,
        session_id: normalizedSessionId, // USAR session_id NORMALIZADO
        valor: valor,
        descricao: descricao || "Pagamento via InfinitePay",
        tipo_cobranca: "link",
        provedor: "infinitepay",
        status: "pendente",
      })
      .select()
      .single();

    if (cobError || !cobranca) {
      console.error("[infinitepay-create-link] Error creating cobranca:", cobError);
      throw new Error("Erro ao criar registro de cobrança");
    }

    console.log(`[infinitepay-create-link] Cobranca created: ${cobranca.id}, session_id: ${normalizedSessionId}`);

    // Create InfinitePay checkout link
    const valorEmCentavos = Math.round(valor * 100);
    const webhookUrl = `${SUPABASE_URL}/functions/v1/infinitepay-webhook`;
    // NÃO usar redirect_url - InfinitePay tem sua própria tela de confirmação

    const infinitePayPayload = {
      handle: handle,
      items: [
        {
          quantity: 1,
          price: valorEmCentavos,
          description: descricao || "Serviço fotográfico",
        },
      ],
      order_nsu: cobranca.id, // UUID da cobrança como NSU
      webhook_url: webhookUrl,
      // redirect_url REMOVIDO - InfinitePay usa tela própria de confirmação
    };

    console.log(`[infinitepay-create-link] Calling InfinitePay API with payload:`, JSON.stringify(infinitePayPayload));

    const ipResponse = await fetch(INFINITEPAY_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(infinitePayPayload),
    });

    if (!ipResponse.ok) {
      const errorText = await ipResponse.text();
      console.error(`[infinitepay-create-link] InfinitePay API error: ${ipResponse.status} - ${errorText}`);
      
      // Delete the cobranca since we couldn't create the link
      await supabase.from("cobrancas").delete().eq("id", cobranca.id);
      
      throw new Error(`Erro na API InfinitePay: ${ipResponse.status}`);
    }

    const ipData = await ipResponse.json();
    console.log(`[infinitepay-create-link] InfinitePay response:`, JSON.stringify(ipData));

    // Extract checkout URL from response
    const checkoutUrl = ipData.checkout_url || ipData.url || ipData.link;
    
    if (!checkoutUrl) {
      console.error("[infinitepay-create-link] No checkout URL in response:", ipData);
      await supabase.from("cobrancas").delete().eq("id", cobranca.id);
      throw new Error("URL de checkout não retornada pela InfinitePay");
    }

    // Update cobranca with checkout URL
    const { error: updateError } = await supabase
      .from("cobrancas")
      .update({
        ip_checkout_url: checkoutUrl,
        ip_order_nsu: cobranca.id,
        mp_payment_link: checkoutUrl, // Also store in legacy field for compatibility
      })
      .eq("id", cobranca.id);

    if (updateError) {
      console.error("[infinitepay-create-link] Error updating cobranca:", updateError);
    }

    console.log(`[infinitepay-create-link] Success! Checkout URL: ${checkoutUrl}`);

    return new Response(
      JSON.stringify({
        success: true,
        cobrancaId: cobranca.id,
        checkoutUrl: checkoutUrl,
        provedor: "infinitepay",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );

  } catch (error) {
    console.error("[infinitepay-create-link] Error:", error);
    
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
