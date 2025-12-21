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

      console.log('[mercadopago-webhook] Processing payment:', paymentId);

      // ===== ESTRATÉGIA 1: Buscar cobrança diretamente por mp_payment_id (PIX) =====
      let { data: cobranca } = await supabase
        .from('cobrancas')
        .select('*')
        .eq('mp_payment_id', String(paymentId))
        .maybeSingle();

      let payment: any = null;
      let accessToken: string | null = null;

      // ===== ESTRATÉGIA 2: Se não encontrou, consultar MP e buscar por preference_id (LINK) =====
      if (!cobranca) {
        console.log('[mercadopago-webhook] Cobrança não encontrada por mp_payment_id, tentando outras estratégias...');

        // Buscar TODAS as integrações ativas para tentar consultar o pagamento
        const { data: integrations } = await supabase
          .from('usuarios_integracoes')
          .select('user_id, access_token')
          .eq('provedor', 'mercadopago')
          .eq('status', 'ativo');

        console.log('[mercadopago-webhook] Encontradas', integrations?.length || 0, 'integrações ativas');

        // Tentar cada token até conseguir consultar o pagamento
        for (const integration of (integrations || [])) {
          if (!integration.access_token) continue;

          try {
            const mpResp = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
              headers: { 'Authorization': `Bearer ${integration.access_token}` }
            });

            if (mpResp.ok) {
              payment = await mpResp.json();
              accessToken = integration.access_token;
              console.log('[mercadopago-webhook] Pagamento consultado com sucesso:', {
                status: payment.status,
                preference_id: payment.preference_id,
                external_reference: payment.external_reference,
                amount: payment.transaction_amount
              });
              break;
            }
          } catch (e) {
            console.log('[mercadopago-webhook] Erro ao consultar com token:', e);
          }
        }

        if (!payment) {
          console.log('[mercadopago-webhook] Não foi possível consultar pagamento no MP');
          return new Response(JSON.stringify({ received: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        // ===== ESTRATÉGIA 2A: Buscar por preference_id =====
        if (payment.preference_id) {
          console.log('[mercadopago-webhook] Buscando por preference_id:', payment.preference_id);
          
          const { data: byPref } = await supabase
            .from('cobrancas')
            .select('*')
            .eq('mp_preference_id', payment.preference_id)
            .maybeSingle();

          if (byPref) {
            console.log('[mercadopago-webhook] Cobrança encontrada por preference_id:', byPref.id);
            cobranca = byPref;
          }
        }

        // ===== ESTRATÉGIA 2B: Buscar por external_reference =====
        if (!cobranca && payment.external_reference) {
          console.log('[mercadopago-webhook] Buscando por external_reference:', payment.external_reference);
          
          // external_reference formato: user_id|cliente_id|session_id
          const parts = payment.external_reference.split('|');
          if (parts.length >= 2) {
            const [userId, clienteId, sessionId] = parts;
            
            let query = supabase
              .from('cobrancas')
              .select('*')
              .eq('user_id', userId)
              .eq('cliente_id', clienteId)
              .eq('status', 'pendente')
              .eq('tipo_cobranca', 'link');

            // Adicionar filtro de session_id se existir
            if (sessionId) {
              query = query.eq('session_id', sessionId);
            }

            const { data: byRef } = await query
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle();

            if (byRef) {
              console.log('[mercadopago-webhook] Cobrança encontrada por external_reference:', byRef.id);
              cobranca = byRef;
            }
          }
        }

        // ===== IMPORTANTE: Atualizar mp_payment_id para referência futura =====
        if (cobranca && !cobranca.mp_payment_id) {
          console.log('[mercadopago-webhook] Atualizando mp_payment_id na cobrança:', cobranca.id);
          await supabase
            .from('cobrancas')
            .update({ 
              mp_payment_id: String(paymentId),
              updated_at: new Date().toISOString()
            })
            .eq('id', cobranca.id);
        }
      }

      // Se ainda não encontrou cobrança, encerrar
      if (!cobranca) {
        console.log('[mercadopago-webhook] Cobrança não encontrada para payment_id:', paymentId);
        return new Response(JSON.stringify({ received: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      console.log('[mercadopago-webhook] Cobrança encontrada:', {
        id: cobranca.id,
        session_id: cobranca.session_id,
        cliente_id: cobranca.cliente_id,
        valor: cobranca.valor,
        tipo_cobranca: cobranca.tipo_cobranca
      });

      // Se ainda não consultamos o pagamento, buscar agora
      if (!payment) {
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

        accessToken = integration.access_token;

        const mpResponse = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
          headers: { 'Authorization': `Bearer ${accessToken}` },
        });

        if (!mpResponse.ok) {
          console.error('[mercadopago-webhook] Failed to fetch payment from MP');
          return new Response(JSON.stringify({ received: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        payment = await mpResponse.json();
      }

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
          mp_payment_id: String(paymentId), // Garantir que está atualizado
          data_pagamento: payment.status === 'approved' ? new Date().toISOString() : null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', cobranca.id)
        .select()
        .single();

      if (updateError) {
        console.error('[mercadopago-webhook] Erro ao atualizar cobrança:', updateError);
        return new Response(JSON.stringify({ received: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      console.log('[mercadopago-webhook] Cobrança atualizada para status:', newStatus);

      // Se pagamento aprovado, criar transação e atualizar valor_pago
      if (newStatus === 'pago' && updatedCobranca.session_id) {
        
        // Buscar o session_id TEXTO correto da tabela clientes_sessoes
        const { data: sessaoData, error: sessaoError } = await supabase
          .from('clientes_sessoes')
          .select('session_id, id')
          .or(`id.eq.${updatedCobranca.session_id},session_id.eq.${updatedCobranca.session_id}`)
          .maybeSingle();

        if (sessaoError) {
          console.error('[mercadopago-webhook] Erro ao buscar sessão:', sessaoError);
        }

        // Usar o session_id texto correto (formato "workflow-xxx")
        const sessionIdParaTransacao = sessaoData?.session_id || updatedCobranca.session_id;
        console.log('[mercadopago-webhook] Session ID para transação:', sessionIdParaTransacao);

        // Descrição da transação baseada no tipo de cobrança
        const tipoCobrancaLabel = updatedCobranca.tipo_cobranca === 'link' ? 'LINK' : 'PIX';
        const descricaoTransacao = `Pagamento via ${tipoCobrancaLabel} - MP #${paymentId}`;

        // Verificar se já existe transação para este pagamento (evitar duplicatas)
        const { data: existingTx } = await supabase
          .from('clientes_transacoes')
          .select('id')
          .eq('session_id', sessionIdParaTransacao)
          .ilike('descricao', `%MP #${paymentId}%`)
          .maybeSingle();

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
            descricao: descricaoTransacao,
          });

          if (insertError) {
            console.error('[mercadopago-webhook] Erro ao criar transação:', insertError);
          } else {
            console.log('[mercadopago-webhook] Transação criada com sucesso:', descricaoTransacao);
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
