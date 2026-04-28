import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface RequestBody {
  cobrancaId: string;
  parcelaId?: string;
  valor?: number;
  motivo?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

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

    const body: RequestBody = await req.json();
    const { cobrancaId, parcelaId, valor, motivo } = body;

    if (!cobrancaId) {
      return new Response(
        JSON.stringify({ success: false, error: 'cobrancaId é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Buscar integração Asaas
    const { data: integracao, error: integError } = await supabase
      .from('usuarios_integracoes')
      .select('access_token, dados_extras')
      .eq('user_id', userId)
      .eq('provedor', 'asaas')
      .eq('status', 'ativo')
      .maybeSingle();

    if (integError || !integracao?.access_token) {
      return new Response(
        JSON.stringify({ success: false, error: 'Integração Asaas não configurada' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const asaasApiKey = integracao.access_token;
    const environment = (integracao.dados_extras as any)?.environment;
    const asaasBaseUrl = environment === 'production'
      ? 'https://api.asaas.com'
      : 'https://api-sandbox.asaas.com';

    // Resolver asaas_payment_id
    let asaasPaymentId: string | null = null;

    if (parcelaId) {
      const { data: parcela } = await supabase
        .from('cobranca_parcelas')
        .select('asaas_payment_id, cobranca_id')
        .eq('id', parcelaId)
        .maybeSingle();
      if (parcela?.asaas_payment_id) {
        asaasPaymentId = parcela.asaas_payment_id;
      }
    }

    if (!asaasPaymentId) {
      // Buscar da cobrança principal (dados_extras pode conter o id)
      const { data: cobranca } = await supabase
        .from('cobrancas')
        .select('id, user_id, provedor, dados_extras')
        .eq('id', cobrancaId)
        .eq('user_id', userId)
        .maybeSingle();

      if (!cobranca || cobranca.provedor !== 'asaas') {
        return new Response(
          JSON.stringify({ success: false, error: 'Cobrança Asaas não encontrada' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const extras = (cobranca.dados_extras || {}) as any;
      asaasPaymentId = extras.asaas_payment_id || extras.paymentId || null;
    }

    if (!asaasPaymentId) {
      return new Response(
        JSON.stringify({ success: false, error: 'ID do pagamento no Asaas não encontrado. Não é possível estornar automaticamente.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Chamar Asaas refund
    const refundBody: Record<string, unknown> = {};
    if (valor && valor > 0) refundBody.value = valor;
    if (motivo) refundBody.description = motivo.substring(0, 500);

    console.log('[asaas-refund] Calling refund for', asaasPaymentId, refundBody);

    const asaasResp = await fetch(`${asaasBaseUrl}/v3/payments/${asaasPaymentId}/refund`, {
      method: 'POST',
      headers: {
        'access_token': asaasApiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(refundBody),
    });

    const asaasData = await asaasResp.json();

    if (!asaasResp.ok) {
      console.error('[asaas-refund] Asaas error:', asaasResp.status, asaasData);
      const errorMsg = asaasData?.errors?.[0]?.description 
        || asaasData?.message 
        || `Erro ${asaasResp.status} no Asaas`;
      return new Response(
        JSON.stringify({ success: false, error: errorMsg, asaasResponse: asaasData }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[asaas-refund] Refund success:', asaasData?.id || asaasData?.status);

    return new Response(
      JSON.stringify({
        success: true,
        refundId: asaasData?.id || asaasPaymentId,
        status: asaasData?.status,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    console.error('[asaas-refund] Unexpected error:', error);
    const msg = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(
      JSON.stringify({ success: false, error: msg }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
