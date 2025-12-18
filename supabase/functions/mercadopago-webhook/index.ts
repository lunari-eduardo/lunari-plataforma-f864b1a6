import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const mercadoPagoToken = Deno.env.get('MERCADOPAGO_ACCESS_TOKEN')!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    console.log('Webhook received:', JSON.stringify(body));

    // Mercado Pago sends different notification types
    const { type, data, action } = body;

    // Handle payment notifications
    if (type === 'payment' || action?.includes('payment')) {
      const paymentId = data?.id;
      
      if (!paymentId) {
        console.log('No payment ID in webhook');
        return new Response(JSON.stringify({ received: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Fetch payment details from Mercado Pago
      const mpResponse = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
        headers: {
          'Authorization': `Bearer ${mercadoPagoToken}`,
        },
      });

      if (!mpResponse.ok) {
        console.error('Failed to fetch payment:', await mpResponse.text());
        return new Response(JSON.stringify({ received: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const payment = await mpResponse.json();
      console.log('Payment details:', JSON.stringify(payment));

      // Map Mercado Pago status to our status
      let newStatus: string;
      switch (payment.status) {
        case 'approved':
          newStatus = 'pago';
          break;
        case 'cancelled':
        case 'refunded':
          newStatus = 'cancelado';
          break;
        case 'rejected':
          newStatus = 'cancelado';
          break;
        default:
          newStatus = 'pendente';
      }

      // Update charge in database
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
        console.error('Error updating charge:', updateError);
        
        // Try to find by preference_id if payment_id doesn't match
        const externalRef = payment.external_reference;
        if (externalRef) {
          console.log('Trying to find by external_reference:', externalRef);
        }
      } else if (updatedCobranca && newStatus === 'pago') {
        console.log('Charge updated to paid:', updatedCobranca.id);

        // Register payment in clientes_transacoes
        if (updatedCobranca.session_id) {
          const { error: transactionError } = await supabase
            .from('clientes_transacoes')
            .insert({
              user_id: updatedCobranca.user_id,
              cliente_id: updatedCobranca.cliente_id,
              session_id: updatedCobranca.session_id,
              valor: updatedCobranca.valor,
              data_transacao: new Date().toISOString().split('T')[0],
              tipo: 'pagamento',
              descricao: `Pagamento via ${updatedCobranca.tipo_cobranca.toUpperCase()} - MP #${paymentId}`,
            });

          if (transactionError) {
            console.error('Error creating transaction:', transactionError);
          } else {
            console.log('Transaction created for session:', updatedCobranca.session_id);
          }
        }
      }
    }

    // Handle merchant_order notifications (for preferences/links)
    if (type === 'merchant_order') {
      const orderId = data?.id;
      
      if (orderId) {
        const mpResponse = await fetch(`https://api.mercadopago.com/merchant_orders/${orderId}`, {
          headers: {
            'Authorization': `Bearer ${mercadoPagoToken}`,
          },
        });

        if (mpResponse.ok) {
          const order = await mpResponse.json();
          console.log('Merchant order:', JSON.stringify(order));

          // Check if fully paid
          if (order.status === 'closed' && order.payments?.length > 0) {
            const approvedPayment = order.payments.find((p: any) => p.status === 'approved');
            
            if (approvedPayment) {
              // Update charge by preference_id
              const { error: updateError } = await supabase
                .from('cobrancas')
                .update({
                  status: 'pago',
                  mp_payment_id: String(approvedPayment.id),
                  data_pagamento: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                })
                .eq('mp_preference_id', order.preference_id);

              if (updateError) {
                console.error('Error updating charge from merchant_order:', updateError);
              }
            }
          }
        }
      }
    }

    return new Response(
      JSON.stringify({ received: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Webhook error:', error);
    // Always return 200 to acknowledge receipt
    return new Response(
      JSON.stringify({ received: true, error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
