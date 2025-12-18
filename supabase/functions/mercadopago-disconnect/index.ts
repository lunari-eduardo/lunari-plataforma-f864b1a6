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

    console.log('[mercadopago-disconnect] Starting disconnect');

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get user from auth header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('[mercadopago-disconnect] Missing authorization header');
      throw new Error('Missing authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      console.error('[mercadopago-disconnect] Invalid user token:', userError);
      throw new Error('Invalid user token');
    }

    console.log('[mercadopago-disconnect] User authenticated:', user.id);

    // Update integration status to disconnected
    const { error: updateError } = await supabase
      .from('usuarios_integracoes')
      .update({
        status: 'desconectado',
        access_token: null,
        refresh_token: null,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', user.id)
      .eq('provedor', 'mercadopago');

    if (updateError) {
      console.error('[mercadopago-disconnect] Database error:', updateError);
      throw new Error('Failed to disconnect integration');
    }

    console.log('[mercadopago-disconnect] Integration disconnected successfully');

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Conta Mercado Pago desconectada com sucesso',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[mercadopago-disconnect] Error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message || 'Erro ao desconectar conta Mercado Pago' 
      }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
