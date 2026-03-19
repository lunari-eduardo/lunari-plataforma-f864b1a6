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

        const { data: integrations } = await supabase
          .from('usuarios_integracoes')
          .select('user_id, access_token')
          .eq('provedor', 'mercadopago')
          .eq('status', 'ativo');

        console.log('[mercadopago-webhook] Encontradas', integrations?.length || 0, 'integrações ativas');

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
                amount: payment.transaction_amount,
                net_received: payment.transaction_details?.net_received_amount,
                fee_details: payment.fee_details,
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

        // Atualizar mp_payment_id para referência futura
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

      // ===== EXTRAIR DADOS DE TAXAS DA API DO MP =====
      // net_received_amount inclui taxas de PIX e cartão
      const netReceived = payment.transaction_details?.net_received_amount ?? null;
      const totalFees = payment.fee_details?.reduce(
        (sum: number, f: any) => sum + (f.amount || 0), 0
      ) ?? 0;

      console.log('[mercadopago-webhook] Dados de taxas MP:', {
        transaction_amount: payment.transaction_amount,
        net_received_amount: netReceived,
        fee_details: payment.fee_details,
        total_fees: totalFees,
      });

      // ===== ATUALIZAR COBRANÇA (com valor_liquido para taxas) =====
      // O trigger ensure_transaction_on_cobranca_paid será disparado quando status mudar para 'pago'
      // Ele automaticamente cria a transação com taxa_gateway = valor - valor_liquido
      const updateData: Record<string, any> = {
        status: newStatus,
        mp_payment_id: String(paymentId),
        data_pagamento: payment.status === 'approved' ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      };

      // Gravar valor_liquido apenas quando aprovado e disponível
      if (newStatus === 'pago' && netReceived !== null && netReceived !== undefined) {
        updateData.valor_liquido = netReceived;
        console.log('[mercadopago-webhook] Gravando valor_liquido:', netReceived, '(taxa_gateway será calculada pelo trigger)');
      }

      const { error: updateError } = await supabase
        .from('cobrancas')
        .update(updateData)
        .eq('id', cobranca.id);

      if (updateError) {
        console.error('[mercadopago-webhook] Erro ao atualizar cobrança:', updateError);
        return new Response(JSON.stringify({ received: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      console.log('[mercadopago-webhook] Cobrança atualizada para status:', newStatus);

      // A criação de transação e atualização de valor_pago são feitas automaticamente
      // pelo trigger ensure_transaction_on_cobranca_paid quando status muda para 'pago'.
      // Não é necessário criar transação manualmente aqui.
      if (newStatus === 'pago') {
        console.log('[mercadopago-webhook] Pagamento aprovado — trigger ensure_transaction_on_cobranca_paid cuidará da transação e recompute_session_paid');
      }
    }

    return new Response(JSON.stringify({ received: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error('[mercadopago-webhook] Error:', error);
    return new Response(JSON.stringify({ received: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
