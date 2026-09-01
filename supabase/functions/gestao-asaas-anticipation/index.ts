import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ success: false, error: "Não autenticado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims?.sub) {
      return new Response(
        JSON.stringify({ success: false, error: "Token inválido" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = claimsData.claims.sub as string;
    const body = await req.json();
    const { action, cobrancaId, parcelaId, asaasPaymentId } = body as {
      action: "simulate" | "request";
      cobrancaId?: string;
      parcelaId?: string;
      asaasPaymentId?: string;
    };

    if (!action || (!cobrancaId && !parcelaId && !asaasPaymentId)) {
      return new Response(
        JSON.stringify({ success: false, error: "action e identificador de cobrança/parcela são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let resolvedPaymentId: string | null = asaasPaymentId || null;
    let resolvedCobranca: any = null;

    if (!resolvedPaymentId && parcelaId) {
      const { data: parcela } = await supabase
        .from("cobranca_parcelas")
        .select("id, asaas_payment_id, cobranca_id, cobrancas(user_id, provedor, status)")
        .eq("id", parcelaId)
        .maybeSingle();

      if (parcela?.asaas_payment_id) {
        resolvedPaymentId = parcela.asaas_payment_id;
        resolvedCobranca = parcela.cobrancas;
      }
    }

    if (!resolvedPaymentId && cobrancaId) {
      const { data: cobranca } = await supabase
        .from("cobrancas")
        .select("id, user_id, valor, valor_liquido, status, provedor, provider_transaction_id")
        .eq("id", cobrancaId)
        .eq("user_id", userId)
        .maybeSingle();

      resolvedCobranca = cobranca;

      if (cobranca?.provider_transaction_id) {
        resolvedPaymentId = cobranca.provider_transaction_id;
      } else if (cobranca) {
        // Tenta buscar na parcela 1
        const { data: pData } = await supabase
          .from("cobranca_parcelas")
          .select("asaas_payment_id")
          .eq("cobranca_id", cobranca.id)
          .maybeSingle();
        if (pData?.asaas_payment_id) {
          resolvedPaymentId = pData.asaas_payment_id;
        }
      }
    }

    if (!resolvedPaymentId) {
      return new Response(
        JSON.stringify({ success: false, error: "Identificador de pagamento Asaas (pay_...) não localizado para antecipação" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch Asaas integration
    const { data: integracao } = await supabase
      .from("usuarios_integracoes")
      .select("access_token, dados_extras")
      .eq("user_id", userId)
      .eq("provedor", "asaas")
      .eq("status", "ativo")
      .order("is_default", { ascending: false })
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!integracao?.access_token) {
      return new Response(
        JSON.stringify({ success: false, error: "Integração Asaas não configurada ou inativa" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const settings = (integracao.dados_extras || {}) as { environment?: string };
    const asaasBaseUrl = settings.environment === "production"
      ? "https://api.asaas.com"
      : "https://api-sandbox.asaas.com";

    const asaasApiKey = integracao.access_token;

    if (action === "simulate") {
      const simResp = await fetch(
        `${asaasBaseUrl}/v3/anticipations/simulate`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", access_token: asaasApiKey },
          body: JSON.stringify({
            payment: resolvedPaymentId,
            anticipationDays: null,
          }),
        }
      );

      const simData = await simResp.json();

      if (!simResp.ok) {
        const errorMsg = simData.errors?.[0]?.description || "Erro ao simular antecipação";
        console.error("Asaas simulation error:", simData);
        return new Response(
          JSON.stringify({ success: false, error: errorMsg }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          simulation: {
            anticipableValue: simData.anticipableValue,
            fee: simData.fee,
            netValue: simData.netValue,
            estimatedCreditDate: simData.estimatedCreditDate,
            totalValue: simData.totalValue,
          },
          paymentId: resolvedPaymentId,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "request") {
      const antResp = await fetch(
        `${asaasBaseUrl}/v3/anticipations`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", access_token: asaasApiKey },
          body: JSON.stringify({
            payment: resolvedPaymentId,
          }),
        }
      );

      const antData = await antResp.json();

      if (!antResp.ok) {
        const errorMsg = antData.errors?.[0]?.description || "Erro ao solicitar antecipação";
        console.error("Asaas anticipation error:", antData);
        return new Response(
          JSON.stringify({ success: false, error: errorMsg }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log(`✅ Anticipation requested for payment ${resolvedPaymentId}: ${antData.id}`);

      return new Response(
        JSON.stringify({
          success: true,
          anticipation: {
            id: antData.id,
            status: antData.status,
            netValue: antData.netValue,
            fee: antData.fee,
            estimatedCreditDate: antData.estimatedCreditDate,
          },
          paymentId: resolvedPaymentId,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: 'Ação inválida. Use "simulate" ou "request"' }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Anticipation error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Erro interno do servidor" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
