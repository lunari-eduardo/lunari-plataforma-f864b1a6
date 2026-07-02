/**
 * FUNÇÃO EXCLUSIVA DO GESTÃO — Usa JWT de usuário (auth.getUser).
 * NÃO é chamada pelo Gallery. Para Gallery, use infinitepay-create-link (contrato compartilhado).
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  assertExtraPaymentWithinIdeal,
  assertNotAmbiguousSessionCharge,
  resolveCobrancaBinding,
} from "../_shared/cobrancaBinding.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
/**
 * Domínio público onde a página /pay/ip/:id está hospedada. Fallback para
 * o domínio de produção quando VITE_SITE_URL não estiver configurado como secret.
 */
const PUBLIC_SITE_URL = (Deno.env.get("VITE_SITE_URL") || Deno.env.get("SITE_URL") || "https://app.lunarihub.com").replace(/\/$/, "");


interface CreateLinkRequest {
  clienteId: string;
  sessionId?: string;
  valor: number;
  descricao?: string;
  // Contrato Gestão↔Gallery (opcional; default = 'sessao')
  finalidade?: "sessao" | "fotos_extras";
  galeriaId?: string;
  qtdFotos?: number;
  snapshotFotosIncluidas?: number | null;
  correlationId?: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get auth user from JWT (Gestão always uses JWT authentication)
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
    const body: CreateLinkRequest = await req.json();
    const { clienteId, sessionId, valor, descricao } = body;

    if (!clienteId || !valor) {
      throw new Error("clienteId e valor são obrigatórios");
    }

    // Resolve contrato finalidade/galeria_id/qtd_fotos (default sessao)
    const { binding, error: bindingError } = await resolveCobrancaBinding(
      supabase,
      userId,
      {
        finalidade: body.finalidade,
        galeriaId: body.galeriaId,
        qtdFotos: body.qtdFotos,
        snapshotFotosIncluidas: body.snapshotFotosIncluidas,
        correlationId: body.correlationId,
      },
    );
    if (bindingError || !binding) {
      return new Response(
        JSON.stringify({ success: false, error: bindingError?.message, code: bindingError?.code }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Guardas de contrato (anti-overcharge + anti-ambiguidade)
    if (binding.finalidade === "fotos_extras" && binding.galeria_id) {
      const guard = await assertExtraPaymentWithinIdeal(supabase, binding.galeria_id, valor);
      if (guard.error) {
        return new Response(
          JSON.stringify({ success: false, error: guard.error.message, code: guard.error.code, details: guard.error.details }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    } else if (binding.finalidade === "sessao" && sessionId) {
      const guard = await assertNotAmbiguousSessionCharge(
        supabase,
        sessionId,
        valor,
        (body as { allowAmbiguous?: boolean }).allowAmbiguous === true,
      );
      if (guard.error) {
        return new Response(
          JSON.stringify({ success: false, error: guard.error.message, code: guard.error.code, details: guard.error.details }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    console.log(`[gestao-infinitepay-create-link] Creating link for user ${userId}, cliente ${clienteId}, valor ${valor}`);

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
      // Primeiro tentar buscar pelo session_id texto (formato workflow-*)
      const { data: byText } = await supabase
        .from("clientes_sessoes")
        .select("session_id")
        .eq("session_id", sessionId)
        .maybeSingle();
      
      if (byText?.session_id) {
        normalizedSessionId = byText.session_id;
        console.log(`[gestao-infinitepay-create-link] Found by text session_id: ${normalizedSessionId}`);
      } else {
        // Fallback: buscar pelo UUID
        const { data: byUuid } = await supabase
          .from("clientes_sessoes")
          .select("session_id")
          .eq("id", sessionId)
          .maybeSingle();
        
        if (byUuid?.session_id) {
          normalizedSessionId = byUuid.session_id;
          console.log(`[gestao-infinitepay-create-link] Found by UUID, text session_id: ${normalizedSessionId}`);
        } else {
          // Sessão não existe - NÃO usar sessionId original
          console.warn(`[gestao-infinitepay-create-link] Session not found for: ${sessionId}`);
          normalizedSessionId = null;
        }
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
        finalidade: binding.finalidade,
        galeria_id: binding.galeria_id,
        qtd_fotos: binding.qtd_fotos,
        snapshot_fotos_incluidas: binding.snapshot_fotos_incluidas,
        correlation_id: binding.correlation_id,
      })
      .select()
      .single();

    if (cobError || !cobranca) {
      console.error("[gestao-infinitepay-create-link] Error creating cobranca:", cobError);
      throw new Error("Erro ao criar registro de cobrança");
    }

    console.log(`[gestao-infinitepay-create-link] Cobranca created: ${cobranca.id}, session_id: ${normalizedSessionId}`);

    /**
     * NÃO chamamos mais a InfinitePay diretamente. Retornamos uma URL
     * intermediária apontando para a página pública /pay/ip/:id no domínio
     * do Gestão. Essa página coleta os dados que faltam no CRM (nome, CPF,
     * telefone, endereço) e SÓ ENTÃO invoca `pay-infinitepay-finalize`, que
     * chama a API real da InfinitePay com `customer{}`/`address{}` pré-preenchidos.
     *
     * Se a `ip_checkout_url` começa com PUBLIC_SITE_URL, é intermediária.
     * Se começa com `checkout.infinitepay.io`, já foi finalizada.
     */
    const intermediateUrl = `${PUBLIC_SITE_URL}/pay/ip/${cobranca.id}`;
    // Handle não é validado aqui — o finalize revalida antes de chamar a API.
    // Apenas checamos existência para dar erro precoce ao fotógrafo.
    void handle;

    const { error: updateError } = await supabase
      .from("cobrancas")
      .update({
        ip_checkout_url: intermediateUrl,
        ip_order_nsu: cobranca.id,
      })
      .eq("id", cobranca.id);

    if (updateError) {
      console.error("[gestao-infinitepay-create-link] Error updating cobranca:", updateError);
    }

    console.log(`[gestao-infinitepay-create-link] Success! Intermediate URL: ${intermediateUrl}`);

    return new Response(
      JSON.stringify({
        success: true,
        cobrancaId: cobranca.id,
        checkoutUrl: intermediateUrl,
        provedor: "infinitepay",
        intermediate: true,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );



  } catch (error) {
    console.error("[gestao-infinitepay-create-link] Error:", error);
    
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
