import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Get MP token for a specific user
async function getUserMpToken(supabase: any, mpUserId: string): Promise<string | null> {
  const { data } = await supabase
    .from('usuarios_integracoes')
    .select('access_token, user_id')
    .eq('mp_user_id', mpUserId)
    .eq('status', 'ativo')
    .single();
  return data?.access_token || null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    console.log('[mercadopago-webhook] Received:', JSON.stringify(body));

    const { type, data, action } = body;

    if (type === 'payment' || action?.includes('payment')) {
      const paymentId = data?.id;
      if (!paymentId) {
        return new Response(JSON.stringify({ received: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // First, find the charge to get the user
      const { data: cobranca } = await supabase
        .from('cobrancas')
        .select('user_id')
        .eq('mp_payment_id', String(paymentId))
        .single();

      let mpToken: string | null = null;
      
      if (cobranca?.user_id) {
        const { data: integration } = await supabase
          .from('usuarios_integracoes')
          .select('access_token')
          .eq('user_id', cobranca.user_id)
          .eq('provedor', 'mercadopago')
          .eq('status', 'ativo')
          .single();
        mpToken = integration?.access_token;
      }

      if (!mpToken) {
        console.log('[mercadopago-webhook] No token found for payment, skipping');
        return new Response(JSON.stringify({ received: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const mpResponse = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
        headers: { 'Authorization': `Bearer ${mpToken}` },
      });

      if (!mpResponse.ok) {
        console.error('[mercadopago-webhook] Failed to fetch payment');
        return new Response(JSON.stringify({ received: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const payment = await mpResponse.json();
      console.log('[mercadopago-webhook] Payment status:', payment.status);

      const statusMap: Record<string, string> = {
        approved: 'pago',
        cancelled: 'cancelado',
        refunded: 'cancelado',
        rejected: 'cancelado',
      };
      const newStatus = statusMap[payment.status] || 'pendente';

      const { data: updatedCobranca, error: updateError } = await supabase
        .from('cobrancas')
        .update({
          status: newStatus,
          data_pagamento: payment.status === 'approved' ? new Date().toISOString() : null,
          updated_at: new Date().toISOString(),
        })
        .eq('mp_payment_id', String(paymentId))
        .select()
        .single();

      if (!updateError && updatedCobranca && newStatus === 'pago' && updatedCobranca.session_id) {
        await supabase.from('clientes_transacoes').insert({
          user_id: updatedCobranca.user_id,
          cliente_id: updatedCobranca.cliente_id,
          session_id: updatedCobranca.session_id,
          valor: updatedCobranca.valor,
          data_transacao: new Date().toISOString().split('T')[0],
          tipo: 'pagamento',
          descricao: `Pagamento via ${updatedCobranca.tipo_cobranca.toUpperCase()} - MP #${paymentId}`,
        });
        console.log('[mercadopago-webhook] Transaction created');
      }
    }

    return new Response(JSON.stringify({ received: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error('[mercadopago-webhook] Error:', error);
    return new Response(JSON.stringify({ received: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
