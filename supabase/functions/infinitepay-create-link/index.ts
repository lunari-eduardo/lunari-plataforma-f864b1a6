/**
 * CONTRATO COMPARTILHADO — NÃO MODIFICAR SEM COORDENAÇÃO
 * Esta função é chamada internamente por confirm-selection usando SUPABASE_SERVICE_ROLE_KEY (não JWT de usuário).
 * 
 * REGRAS IMUTÁVEIS:
 * 1. NÃO adicionar verificação de JWT (auth.getUser)
 * 2. userId DEVE ser aceito no body da request
 * 3. verify_jwt DEVE ser false no config.toml
 * 4. Autenticação do fotógrafo é via userId no body
 * 
 * Projetos: Gallery (Select) + Gestão
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const INFINITEPAY_API_URL = "https://api.checkout.infinitepay.io/links";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const PUBLIC_SITE_URL = (Deno.env.get("VITE_SITE_URL") || Deno.env.get("SITE_URL") || "https://app.lunarihub.com").replace(/\/$/, "");

interface CreateLinkRequest {
  userId: string;
  clienteId: string;
  sessionId?: string;
  valor: number;
  descricao?: string;
  /**
   * Quando true, gera o link diretamente na InfinitePay sem página intermediária.
   * Padrão false = retorna a URL da página pública /pay/ip/:id do Gestão para
   * que o cliente final complete dados faltantes.
   * O Gallery pode passar true para manter comportamento legado se necessário.
   */
  skipPrefillPage?: boolean;
}


serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // userId vem do body (chamada interna via Service Role Key)
    const { userId, clienteId, sessionId, valor, descricao }: CreateLinkRequest = await req.json();

    if (!userId) {
      throw new Error("userId é obrigatório no body");
    }
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

    // NORMALIZE session_id — preserva original se não encontrar match (evita NULL órfão)
    let normalizedSessionId: string | null = sessionId || null;
    if (sessionId) {
      const { data: byText } = await supabase
        .from("clientes_sessoes")
        .select("session_id")
        .eq("session_id", sessionId)
        .maybeSingle();
      
      if (byText?.session_id) {
        normalizedSessionId = byText.session_id;
      } else {
        const { data: byUuid } = await supabase
          .from("clientes_sessoes")
          .select("session_id")
          .eq("id", sessionId)
          .maybeSingle();
        
        if (byUuid?.session_id) {
          normalizedSessionId = byUuid.session_id;
        } else {
          // Não achou em clientes_sessoes — preserva sessionId original (ex: 'agenda-xxx')
          // O webhook resolve depois via session_id OR id::text
          console.warn(`[infinitepay-create-link] Session not found in clientes_sessoes for: ${sessionId}. Preserving original.`);
          normalizedSessionId = sessionId;
        }
      }
    }

    // Create cobranca record
    const { data: cobranca, error: cobError } = await supabase
      .from("cobrancas")
      .insert({
        user_id: userId,
        cliente_id: clienteId,
        session_id: normalizedSessionId,
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

    const valorEmCentavos = Math.round(valor * 100);
    const webhookUrl = `${SUPABASE_URL}/functions/v1/infinitepay-webhook`;

    const infinitePayPayload = {
      handle: handle,
      items: [
        {
          quantity: 1,
          price: valorEmCentavos,
          description: descricao || "Serviço fotográfico",
        },
      ],
      order_nsu: cobranca.id,
      webhook_url: webhookUrl,
    };

    console.log(`[infinitepay-create-link] Calling InfinitePay API with payload:`, JSON.stringify(infinitePayPayload));

    const ipResponse = await fetch(INFINITEPAY_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(infinitePayPayload),
    });

    if (!ipResponse.ok) {
      const errorText = await ipResponse.text();
      console.error(`[infinitepay-create-link] InfinitePay API error: ${ipResponse.status} - ${errorText}`);
      await supabase.from("cobrancas").delete().eq("id", cobranca.id);
      throw new Error(`Erro na API InfinitePay: ${ipResponse.status}`);
    }

    const ipData = await ipResponse.json();
    console.log(`[infinitepay-create-link] InfinitePay response:`, JSON.stringify(ipData));

    const checkoutUrl = ipData.checkout_url || ipData.url || ipData.link;
    
    if (!checkoutUrl) {
      console.error("[infinitepay-create-link] No checkout URL in response:", ipData);
      await supabase.from("cobrancas").delete().eq("id", cobranca.id);
      throw new Error("URL de checkout não retornada pela InfinitePay");
    }

    await supabase
      .from("cobrancas")
      .update({
        ip_checkout_url: checkoutUrl,
        ip_order_nsu: cobranca.id,
        mp_payment_link: checkoutUrl,
      })
      .eq("id", cobranca.id);

    console.log(`[infinitepay-create-link] Success! Checkout URL: ${checkoutUrl}`);

    return new Response(
      JSON.stringify({
        success: true,
        cobrancaId: cobranca.id,
        checkoutUrl: checkoutUrl,
        provedor: "infinitepay",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );

  } catch (error) {
    console.error("[infinitepay-create-link] Error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Erro desconhecido",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
    );
  }
});
