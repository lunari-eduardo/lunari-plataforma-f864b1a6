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

    // Get user from auth header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      throw new Error('Invalid user token');
    }

    const { clienteId, sessionId, valor, descricao, installments } = await req.json();

    if (!clienteId || !valor) {
      throw new Error('clienteId and valor are required');
    }

    // Fetch client info
    const { data: cliente, error: clienteError } = await supabase
      .from('clientes')
      .select('nome, email')
      .eq('id', clienteId)
      .eq('user_id', user.id)
      .single();

    if (clienteError || !cliente) {
      throw new Error('Client not found');
    }

    // Create preference (payment link) in Mercado Pago
    const preferenceData = {
      items: [
        {
          title: descricao || `Cobrança - ${cliente.nome}`,
          quantity: 1,
          unit_price: valor,
          currency_id: 'BRL',
        },
      ],
      payer: {
        email: cliente.email || `${user.id}@cliente.lunari.app`,
        name: cliente.nome,
      },
      external_reference: `${user.id}|${clienteId}|${sessionId || 'avulso'}`,
      payment_methods: {
        installments: installments || 12,
        excluded_payment_types: [],
      },
      back_urls: {
        success: `${supabaseUrl.replace('.supabase.co', '')}/payment-success`,
        failure: `${supabaseUrl.replace('.supabase.co', '')}/payment-failure`,
        pending: `${supabaseUrl.replace('.supabase.co', '')}/payment-pending`,
      },
      auto_return: 'approved',
      expires: true,
      expiration_date_from: new Date().toISOString(),
      expiration_date_to: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
    };

    console.log('Creating payment link:', preferenceData);

    const mpResponse = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${mercadoPagoToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(preferenceData),
    });

    const mpResult = await mpResponse.json();

    if (!mpResponse.ok) {
      console.error('Mercado Pago error:', mpResult);
      throw new Error(mpResult.message || 'Failed to create payment link');
    }

    console.log('Mercado Pago preference created:', mpResult.id);

    // Save to database
    const { data: cobranca, error: insertError } = await supabase
      .from('cobrancas')
      .insert({
        user_id: user.id,
        cliente_id: clienteId,
        session_id: sessionId || null,
        valor,
        descricao: descricao || `Link de pagamento - ${cliente.nome}`,
        tipo_cobranca: 'link',
        status: 'pendente',
        mp_preference_id: mpResult.id,
        mp_payment_link: mpResult.init_point,
        mp_expiration_date: preferenceData.expiration_date_to,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Database insert error:', insertError);
      throw new Error('Failed to save charge');
    }

    return new Response(
      JSON.stringify({
        success: true,
        cobranca: {
          id: cobranca.id,
          valor: cobranca.valor,
          status: cobranca.status,
          tipoCobranca: cobranca.tipo_cobranca,
        },
        paymentLink: mpResult.init_point,
        sandboxLink: mpResult.sandbox_init_point, // For testing
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error creating link:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
