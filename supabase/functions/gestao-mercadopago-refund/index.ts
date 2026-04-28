import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface RequestBody {
  cobrancaId: string;
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
    const { cobrancaId, valor, motivo } = body;

    if (!cobrancaId) {
      return new Response(
        JSON.stringify({ success: false, error: 'cobrancaId é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Buscar integração MP
    const { data: integracao, error: integError } = await supabase
      .from('usuarios_integracoes')
      .select('access_token')
      .eq('user_id', userId)
      .eq('provedor', 'mercadopago')
      .eq('status', 'ativo')
      .maybeSingle();

    if (integError || !integracao?.access_token) {
      return new Response(
        JSON.stringify({ success: false, error: 'Integração Mercado Pago não configurada' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const mpToken = integracao.access_token;

    // Buscar mp_payment_id da cobrança
    const { data: cobranca } = await supabase
      .from('cobrancas')
      .select('id, user_id, provedor, mp_payment_id')
      .eq('id', cobrancaId)
      .eq('user_id', userId)
      .maybeSingle();

    if (!cobranca || cobranca.provedor !== 'mercadopago') {
      return new Response(
        JSON.stringify({ success: false, error: 'Cobrança Mercado Pago não encontrada' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const mpPaymentId = cobranca.mp_payment_id;
    if (!mpPaymentId) {
      return new Response(
        JSON.stringify({ success: false, error: 'ID do pagamento no Mercado Pago não encontrado. Não é possível estornar automaticamente.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Chamar MP refund
    const refundBody: Record<string, unknown> = {};
    if (valor && valor > 0) refundBody.amount = valor;

    console.log('[mp-refund] Calling refund for', mpPaymentId, refundBody);

    const idempotencyKey = `refund-${cobrancaId}-${Date.now()}`;

    const mpResp = await fetch(`https://api.mercadopago.com/v1/payments/${mpPaymentId}/refunds`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${mpToken}`,
        'Content-Type': 'application/json',
        'X-Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify(refundBody),
    });

    const mpData = await mpResp.json();

    if (!mpResp.ok) {
      console.error('[mp-refund] MP error:', mpResp.status, mpData);
      const errorMsg = mpData?.message 
        || mpData?.error 
        || `Erro ${mpResp.status} no Mercado Pago`;
      return new Response(
        JSON.stringify({ success: false, error: errorMsg, mpResponse: mpData }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[mp-refund] Refund success:', mpData?.id, mpData?.status);

    // Motivo é apenas descritivo - MP refund API não aceita description
    if (motivo) {
      console.log('[mp-refund] Motivo (apenas auditoria interna):', motivo);
    }

    return new Response(
      JSON.stringify({
        success: true,
        refundId: mpData?.id,
        status: mpData?.status,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    console.error('[mp-refund] Unexpected error:', error);
    const msg = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(
      JSON.stringify({ success: false, error: msg }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
