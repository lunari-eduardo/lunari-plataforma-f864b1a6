import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper function to get user's Mercado Pago token
async function getUserMpToken(supabase: any, userId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('usuarios_integracoes')
    .select('access_token, status')
    .eq('user_id', userId)
    .eq('provedor', 'mercadopago')
    .eq('status', 'ativo')
    .single();

  if (error || !data?.access_token) {
    console.log('[mercadopago-create-pix] No active MP integration for user:', userId);
    return null;
  }

  return data.access_token;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get user from auth header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('[mercadopago-create-pix] Missing authorization header');
      throw new Error('Missing authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      console.error('[mercadopago-create-pix] Invalid user token:', userError);
      throw new Error('Invalid user token');
    }

    console.log('[mercadopago-create-pix] User authenticated:', user.id);

    // Get user's Mercado Pago token - REQUIRED, no fallback
    const mercadoPagoToken = await getUserMpToken(supabase, user.id);
    
    if (!mercadoPagoToken) {
      console.error('[mercadopago-create-pix] User has no active MP integration');
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Conecte sua conta Mercado Pago antes de cobrar',
          errorCode: 'MP_NOT_CONNECTED'
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const rawBody = await req.clone().text();
    console.log('[mercadopago-create-pix] Raw request body:', rawBody);

    let body;
    try {
      body = await req.json();
    } catch (parseError) {
      console.error('[mercadopago-create-pix] Failed to parse body:', parseError);
      throw new Error('Invalid request body - could not parse JSON');
    }

    console.log('[mercadopago-create-pix] Parsed body:', JSON.stringify(body));

    const { clienteId, sessionId, valor, descricao } = body;

    // FALLBACK: Se clienteId vazio mas temos sessionId, buscar do banco
    let clienteIdFinal = clienteId;
    if (!clienteIdFinal && sessionId) {
      console.log('[mercadopago-create-pix] clienteId vazio, buscando via sessionId:', sessionId);
      
      const { data: session } = await supabase
        .from('clientes_sessoes')
        .select('cliente_id')
        .or(`id.eq.${sessionId},session_id.eq.${sessionId}`)
        .eq('user_id', user.id)
        .maybeSingle();
      
      if (session?.cliente_id) {
        clienteIdFinal = session.cliente_id;
        console.log('[mercadopago-create-pix] clienteId resolvido via sessão:', clienteIdFinal);
      }
    }

    if (!clienteIdFinal) {
      console.error('[mercadopago-create-pix] Missing clienteId');
      throw new Error('clienteId é obrigatório');
    }
    
    if (!valor || valor <= 0) {
      console.error('[mercadopago-create-pix] Invalid valor:', valor);
      throw new Error('valor deve ser maior que zero');
    }

    // Fetch client info
    const { data: cliente, error: clienteError } = await supabase
      .from('clientes')
      .select('nome, email')
      .eq('id', clienteIdFinal)
      .eq('user_id', user.id)
      .single();

    if (clienteError || !cliente) {
      console.error('[mercadopago-create-pix] Client not found:', clienteError);
      throw new Error('Cliente não encontrado');
    }

    console.log('[mercadopago-create-pix] Client found:', cliente.nome);

    // Create Pix payment in Mercado Pago
    const paymentData = {
      transaction_amount: Number(valor),
      description: descricao || `Cobrança - ${cliente.nome}`,
      payment_method_id: 'pix',
      payer: {
        email: cliente.email || `cliente-${clienteIdFinal.substring(0, 8)}@lunari.app`,
        first_name: cliente.nome.split(' ')[0],
        last_name: cliente.nome.split(' ').slice(1).join(' ') || 'Cliente',
      },
      external_reference: `${user.id}|${clienteIdFinal}|${sessionId || 'avulso'}`,
    };

    console.log('[mercadopago-create-pix] Sending to MP:', JSON.stringify(paymentData));

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
    console.log('[mercadopago-create-pix] MP Response status:', mpResponse.status);
    console.log('[mercadopago-create-pix] MP Response:', JSON.stringify(mpResult));

    if (!mpResponse.ok) {
      console.error('[mercadopago-create-pix] Mercado Pago error:', JSON.stringify(mpResult));
      const errorMessage = mpResult.message || mpResult.cause?.[0]?.description || 'Falha ao criar Pix';
      throw new Error(errorMessage);
    }

    console.log('[mercadopago-create-pix] Mercado Pago Pix created:', mpResult.id);

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
        cliente_id: clienteIdFinal,
        session_id: sessionId || null,
        valor: Number(valor),
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
      console.error('[mercadopago-create-pix] Database insert error:', insertError);
      throw new Error('Falha ao salvar cobrança');
    }

    console.log('[mercadopago-create-pix] Charge saved:', cobranca.id);

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
    console.error('[mercadopago-create-pix] Error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message || 'Erro ao criar Pix' 
      }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
