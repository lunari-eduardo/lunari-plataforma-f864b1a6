import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Authenticate user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ success: false, error: 'Não autenticado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims?.sub) {
      return new Response(
        JSON.stringify({ success: false, error: 'Token inválido' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = claimsData.claims.sub as string;
    const body = await req.json();
    const { action, cobrancaId } = body as { action: 'simulate' | 'request'; cobrancaId: string };

    if (!action || !cobrancaId) {
      return new Response(
        JSON.stringify({ success: false, error: 'action e cobrancaId são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch cobrança (must belong to user, be paid, and be Asaas)
    const { data: cobranca, error: cobrancaErr } = await supabase
      .from('cobrancas')
      .select('id, user_id, mp_payment_id, valor, valor_liquido, status, provedor, tipo_cobranca')
      .eq('id', cobrancaId)
      .eq('user_id', userId)
      .maybeSingle();

    if (cobrancaErr || !cobranca) {
      return new Response(
        JSON.stringify({ success: false, error: 'Cobrança não encontrada' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (cobranca.provedor !== 'asaas' || !cobranca.mp_payment_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'Cobrança não é do Asaas ou não possui ID de pagamento' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (cobranca.status !== 'pago') {
      return new Response(
        JSON.stringify({ success: false, error: 'Apenas cobranças pagas podem ser antecipadas' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch Asaas integration
    const { data: integracao } = await supabase
      .from('usuarios_integracoes')
      .select('access_token, dados_extras')
      .eq('user_id', userId)
      .eq('provedor', 'asaas')
      .eq('status', 'ativo')
      .maybeSingle();

    if (!integracao?.access_token) {
      return new Response(
        JSON.stringify({ success: false, error: 'Integração Asaas não configurada' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const settings = (integracao.dados_extras || {}) as { environment?: string };
    const asaasBaseUrl = settings.environment === 'production'
      ? 'https://api.asaas.com'
      : 'https://api-sandbox.asaas.com';

    const asaasApiKey = integracao.access_token;

    if (action === 'simulate') {
      // Simulate anticipation for this payment
      const simResp = await fetch(
        `${asaasBaseUrl}/v3/anticipations/simulate`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', access_token: asaasApiKey },
          body: JSON.stringify({
            payment: cobranca.mp_payment_id,
            anticipationDays: null, // Asaas will use default (today)
          }),
        }
      );

      const simData = await simResp.json();

      if (!simResp.ok) {
        const errorMsg = simData.errors?.[0]?.description || 'Erro ao simular antecipação';
        console.error('Asaas simulation error:', simData);
        return new Response(
          JSON.stringify({ success: false, error: errorMsg }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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
          cobranca: {
            id: cobranca.id,
            valor: cobranca.valor,
            valorLiquido: cobranca.valor_liquido,
          },
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'request') {
      // Request anticipation
      const antResp = await fetch(
        `${asaasBaseUrl}/v3/anticipations`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', access_token: asaasApiKey },
          body: JSON.stringify({
            payment: cobranca.mp_payment_id,
          }),
        }
      );

      const antData = await antResp.json();

      if (!antResp.ok) {
        const errorMsg = antData.errors?.[0]?.description || 'Erro ao solicitar antecipação';
        console.error('Asaas anticipation error:', antData);
        return new Response(
          JSON.stringify({ success: false, error: errorMsg }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`✅ Anticipation requested for payment ${cobranca.mp_payment_id}: ${antData.id}`);

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
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: 'Ação inválida. Use "simulate" ou "request"' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Anticipation error:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Erro interno do servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
