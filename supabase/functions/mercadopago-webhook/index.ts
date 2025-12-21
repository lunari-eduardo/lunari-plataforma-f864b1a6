import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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
        console.log('[mercadopago-webhook] No payment ID found, skipping');
        return new Response(JSON.stringify({ received: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // Buscar a cobrança para obter o user_id
      const { data: cobranca, error: cobrancaError } = await supabase
        .from('cobrancas')
        .select('*')
        .eq('mp_payment_id', String(paymentId))
        .single();

      if (cobrancaError || !cobranca) {
        console.log('[mercadopago-webhook] Cobrança não encontrada para payment_id:', paymentId);
        return new Response(JSON.stringify({ received: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      console.log('[mercadopago-webhook] Cobrança encontrada:', {
        id: cobranca.id,
        session_id: cobranca.session_id,
        cliente_id: cobranca.cliente_id,
        valor: cobranca.valor
      });

      // Buscar token do MP para este usuário
      const { data: integration } = await supabase
        .from('usuarios_integracoes')
        .select('access_token')
        .eq('user_id', cobranca.user_id)
        .eq('provedor', 'mercadopago')
        .eq('status', 'ativo')
        .single();

      if (!integration?.access_token) {
        console.log('[mercadopago-webhook] No MP token found for user, skipping');
        return new Response(JSON.stringify({ received: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // Consultar status do pagamento no MP
      const mpResponse = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
        headers: { 'Authorization': `Bearer ${integration.access_token}` },
      });

      if (!mpResponse.ok) {
        console.error('[mercadopago-webhook] Failed to fetch payment from MP');
        return new Response(JSON.stringify({ received: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const payment = await mpResponse.json();
      console.log('[mercadopago-webhook] Payment status:', payment.status);

      // Mapear status do MP para status interno
      const statusMap: Record<string, string> = {
        approved: 'pago',
        cancelled: 'cancelado',
        refunded: 'cancelado',
        rejected: 'cancelado',
      };
      const newStatus = statusMap[payment.status] || 'pendente';

      // Atualizar cobrança
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

      if (updateError) {
        console.error('[mercadopago-webhook] Erro ao atualizar cobrança:', updateError);
        return new Response(JSON.stringify({ received: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      console.log('[mercadopago-webhook] Cobrança atualizada para status:', newStatus);

      // Se pagamento aprovado, criar transação e atualizar valor_pago
      if (newStatus === 'pago' && updatedCobranca.session_id) {
        
        // IMPORTANTE: Buscar o session_id TEXTO correto da tabela clientes_sessoes
        // A cobrança pode ter o UUID, mas precisamos do session_id texto para a transação
        const { data: sessaoData, error: sessaoError } = await supabase
          .from('clientes_sessoes')
          .select('session_id, id')
          .or(`id.eq.${updatedCobranca.session_id},session_id.eq.${updatedCobranca.session_id}`)
          .single();

        if (sessaoError) {
          console.error('[mercadopago-webhook] Erro ao buscar sessão:', sessaoError);
        }

        // Usar o session_id texto correto (formato "workflow-xxx")
        const sessionIdParaTransacao = sessaoData?.session_id || updatedCobranca.session_id;
        console.log('[mercadopago-webhook] Session ID para transação:', sessionIdParaTransacao);

        // Verificar se já existe transação para este pagamento (evitar duplicatas)
        const { data: existingTx } = await supabase
          .from('clientes_transacoes')
          .select('id')
          .eq('descricao', `Pagamento via ${updatedCobranca.tipo_cobranca.toUpperCase()} - MP #${paymentId}`)
          .eq('session_id', sessionIdParaTransacao)
          .single();

        if (existingTx) {
          console.log('[mercadopago-webhook] Transação já existe, pulando criação');
        } else {
          // Criar transação de pagamento
          const { error: insertError } = await supabase.from('clientes_transacoes').insert({
            user_id: updatedCobranca.user_id,
            cliente_id: updatedCobranca.cliente_id,
            session_id: sessionIdParaTransacao,
            valor: updatedCobranca.valor,
            data_transacao: new Date().toISOString().split('T')[0],
            tipo: 'pagamento',
            descricao: `Pagamento via ${updatedCobranca.tipo_cobranca.toUpperCase()} - MP #${paymentId}`,
          });

          if (insertError) {
            console.error('[mercadopago-webhook] Erro ao criar transação:', insertError);
          } else {
            console.log('[mercadopago-webhook] Transação criada com sucesso');
          }
        }

        // Recalcular e atualizar valor_pago na sessão
        const { data: totalTransacoes } = await supabase
          .from('clientes_transacoes')
          .select('valor')
          .eq('session_id', sessionIdParaTransacao)
          .eq('tipo', 'pagamento');

        const novoValorPago = (totalTransacoes || []).reduce((sum, t) => sum + Number(t.valor), 0);
        console.log('[mercadopago-webhook] Novo valor_pago calculado:', novoValorPago);

        const { error: updateSessaoError } = await supabase
          .from('clientes_sessoes')
          .update({ 
            valor_pago: novoValorPago, 
            updated_at: new Date().toISOString() 
          })
          .or(`id.eq.${updatedCobranca.session_id},session_id.eq.${sessionIdParaTransacao}`);

        if (updateSessaoError) {
          console.error('[mercadopago-webhook] Erro ao atualizar valor_pago:', updateSessaoError);
        } else {
          console.log('[mercadopago-webhook] valor_pago atualizado na sessão');
        }
      }
    }

    return new Response(JSON.stringify({ received: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error('[mercadopago-webhook] Error:', error);
    return new Response(JSON.stringify({ received: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
