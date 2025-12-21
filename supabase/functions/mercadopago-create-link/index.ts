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
    console.log('[mercadopago-create-link] No active MP integration for user:', userId);
    return null;
  }

  return data.access_token;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('[mercadopago-create-link] Missing authorization header');
      throw new Error('Missing authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      console.error('[mercadopago-create-link] Invalid user token:', userError);
      throw new Error('Invalid user token');
    }

    console.log('[mercadopago-create-link] User authenticated:', user.id);

    // Get user's Mercado Pago token - REQUIRED
    const mercadoPagoToken = await getUserMpToken(supabase, user.id);
    
    if (!mercadoPagoToken) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Conecte sua conta Mercado Pago antes de cobrar',
          errorCode: 'MP_NOT_CONNECTED'
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const rawBody = await req.clone().text();
    console.log('[mercadopago-create-link] Raw body:', rawBody);

    const body = await req.json();
    console.log('[mercadopago-create-link] Parsed body:', JSON.stringify(body));

    const { clienteId, sessionId, valor, descricao, installments } = body;

    // FALLBACK: Se clienteId vazio mas temos sessionId, buscar do banco
    let clienteIdFinal = clienteId;
    let textSessionId = sessionId || null;
    
    if (sessionId) {
      console.log('[mercadopago-create-link] Buscando session_id texto para:', sessionId);
      
      const { data: sessaoData } = await supabase
        .from('clientes_sessoes')
        .select('cliente_id, session_id')
        .or(`id.eq.${sessionId},session_id.eq.${sessionId}`)
        .eq('user_id', user.id)
        .maybeSingle();
      
      if (sessaoData) {
        // Usar session_id texto (ex: workflow-xxx)
        textSessionId = sessaoData.session_id;
        console.log('[mercadopago-create-link] session_id texto resolvido:', textSessionId);
        
        if (!clienteIdFinal && sessaoData.cliente_id) {
          clienteIdFinal = sessaoData.cliente_id;
          console.log('[mercadopago-create-link] clienteId resolvido via sessão:', clienteIdFinal);
        }
      }
    }

    if (!clienteIdFinal) throw new Error('clienteId é obrigatório');
    if (!valor || valor <= 0) throw new Error('valor deve ser maior que zero');

    const { data: cliente, error: clienteError } = await supabase
      .from('clientes')
      .select('nome, email')
      .eq('id', clienteIdFinal)
      .eq('user_id', user.id)
      .single();

    if (clienteError || !cliente) throw new Error('Cliente não encontrado');

    // URLs de retorno para o Mercado Pago
    const baseUrl = 'https://lunari.app';
    
    const preferenceData = {
      items: [{
        title: descricao || `Cobrança - ${cliente.nome}`,
        quantity: 1,
        unit_price: Number(valor),
        currency_id: 'BRL',
      }],
      payer: {
        email: cliente.email || `cliente-${clienteIdFinal.substring(0, 8)}@lunari.app`,
        name: cliente.nome,
      },
      back_urls: {
        success: `${baseUrl}/pagamento/sucesso`,
        failure: `${baseUrl}/pagamento/falha`,
        pending: `${baseUrl}/pagamento/pendente`,
      },
      auto_return: 'approved',
      external_reference: `${user.id}|${clienteIdFinal}|${textSessionId || 'avulso'}`,
      payment_methods: {
        installments: installments || 12,
        excluded_payment_types: [],
      },
      expires: true,
      expiration_date_from: new Date().toISOString(),
      expiration_date_to: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    };

    console.log('[mercadopago-create-link] Sending to MP:', JSON.stringify(preferenceData));

    const mpResponse = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${mercadoPagoToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(preferenceData),
    });

    const mpResult = await mpResponse.json();
    console.log('[mercadopago-create-link] MP Response:', JSON.stringify(mpResult));

    if (!mpResponse.ok) {
      throw new Error(mpResult.message || 'Falha ao criar link de pagamento');
    }

    // Salvar cobrança com session_id TEXTO
    const { data: cobranca, error: insertError } = await supabase
      .from('cobrancas')
      .insert({
        user_id: user.id,
        cliente_id: clienteIdFinal,
        session_id: textSessionId,
        valor: Number(valor),
        descricao: descricao || `Link de pagamento - ${cliente.nome}`,
        tipo_cobranca: 'link',
        status: 'pendente',
        mp_preference_id: mpResult.id,
        mp_payment_link: mpResult.init_point,
        mp_expiration_date: preferenceData.expiration_date_to,
      })
      .select()
      .single();

    if (insertError) throw new Error('Falha ao salvar cobrança');

    console.log('[mercadopago-create-link] Cobrança salva com session_id:', textSessionId);

    return new Response(
      JSON.stringify({
        success: true,
        cobranca: { id: cobranca.id, valor: cobranca.valor, status: cobranca.status },
        paymentLink: mpResult.init_point,
        sandboxLink: mpResult.sandbox_init_point,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[mercadopago-create-link] Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
