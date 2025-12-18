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

    const { clienteId, sessionId, valor, descricao } = await req.json();

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

    // Create Pix payment in Mercado Pago
    const paymentData = {
      transaction_amount: valor,
      description: descricao || `Cobrança - ${cliente.nome}`,
      payment_method_id: 'pix',
      payer: {
        email: cliente.email || `${user.id}@cliente.lunari.app`,
        first_name: cliente.nome.split(' ')[0],
        last_name: cliente.nome.split(' ').slice(1).join(' ') || 'Cliente',
      },
      external_reference: `${user.id}|${clienteId}|${sessionId || 'avulso'}`,
    };

    console.log('Creating Pix payment:', paymentData);

    const mpResponse = await fetch('https://api.mercadopago.com/v1/payments', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${mercadoPagoToken}`,
        'Content-Type': 'application/json',
        'X-Idempotency-Key': `${user.id}-${clienteId}-${Date.now()}`,
      },
      body: JSON.stringify(paymentData),
    });

    const mpResult = await mpResponse.json();

    if (!mpResponse.ok) {
      console.error('Mercado Pago error:', mpResult);
      throw new Error(mpResult.message || 'Failed to create Pix payment');
    }

    console.log('Mercado Pago Pix created:', mpResult.id);

    // Extract Pix data
    const qrCode = mpResult.point_of_interaction?.transaction_data?.qr_code;
    const qrCodeBase64 = mpResult.point_of_interaction?.transaction_data?.qr_code_base64;
    const pixCopiaCola = mpResult.point_of_interaction?.transaction_data?.qr_code;
    const expirationDate = mpResult.date_of_expiration;

    // Save to database
    const { data: cobranca, error: insertError } = await supabase
      .from('cobrancas')
      .insert({
        user_id: user.id,
        cliente_id: clienteId,
        session_id: sessionId || null,
        valor,
        descricao: descricao || `Cobrança Pix - ${cliente.nome}`,
        tipo_cobranca: 'pix',
        status: 'pendente',
        mp_payment_id: String(mpResult.id),
        mp_qr_code: qrCode,
        mp_qr_code_base64: qrCodeBase64,
        mp_pix_copia_cola: pixCopiaCola,
        mp_expiration_date: expirationDate,
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
        qrCode,
        qrCodeBase64,
        pixCopiaCola,
        expirationDate,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error creating Pix:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
