import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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
    const accessToken = Deno.env.get('MERCADOPAGO_ACCESS_TOKEN');
    
    if (!accessToken) {
      throw new Error('MERCADOPAGO_ACCESS_TOKEN não configurado');
    }

    console.log('🔄 Criando pagamento técnico de validação no Mercado Pago...');

    const payload = {
      transaction_amount: 1,
      description: "Pagamento técnico de validação Lunari",
      payment_method_id: "pix",
      external_reference: "lunari-validacao",
      payer: {
        email: "teste@lunari.app"
      }
    };

    console.log('📦 Payload:', JSON.stringify(payload));

    const response = await fetch('https://api.mercadopago.com/v1/payments', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-Idempotency-Key': `lunari-validacao-${Date.now()}`
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    console.log('📥 Resposta MP status:', response.status);
    console.log('📥 Resposta MP:', JSON.stringify(data));

    if (!response.ok) {
      return new Response(JSON.stringify({
        success: false,
        error: data.message || 'Erro ao criar pagamento',
        details: data
      }), {
        status: response.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Extrair dados relevantes
    const result = {
      success: true,
      payment_id: data.id,
      status: data.status,
      status_detail: data.status_detail,
      init_point: data.point_of_interaction?.transaction_data?.ticket_url || null,
      qr_code: data.point_of_interaction?.transaction_data?.qr_code || null,
      qr_code_base64: data.point_of_interaction?.transaction_data?.qr_code_base64 || null,
      external_reference: data.external_reference,
      date_created: data.date_created
    };

    console.log('✅ Pagamento criado:', JSON.stringify(result));

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Erro:', error.message);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
