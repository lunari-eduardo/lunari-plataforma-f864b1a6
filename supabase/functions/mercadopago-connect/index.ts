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
    const mpAppId = Deno.env.get('MERCADOPAGO_APP_ID')!;
    const mpClientSecret = Deno.env.get('MERCADOPAGO_CLIENT_SECRET')!;

    console.log('[mercadopago-connect] Starting OAuth token exchange');

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get user from auth header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('[mercadopago-connect] Missing authorization header');
      throw new Error('Missing authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      console.error('[mercadopago-connect] Invalid user token:', userError);
      throw new Error('Invalid user token');
    }

    console.log('[mercadopago-connect] User authenticated:', user.id);

    const body = await req.json();
    console.log('[mercadopago-connect] Request body:', JSON.stringify(body));

    const { code, redirectUri } = body;

    if (!code) {
      console.error('[mercadopago-connect] Missing authorization code');
      throw new Error('Authorization code is required');
    }

    // Exchange code for tokens via Mercado Pago OAuth
    const tokenUrl = 'https://api.mercadopago.com/oauth/token';
    const tokenBody = {
      grant_type: 'authorization_code',
      client_id: mpAppId,
      client_secret: mpClientSecret,
      code: code,
      redirect_uri: redirectUri || `${supabaseUrl}/functions/v1/mercadopago-connect`,
    };

    console.log('[mercadopago-connect] Exchanging code for token at:', tokenUrl);
    console.log('[mercadopago-connect] Token request (without secret):', {
      grant_type: tokenBody.grant_type,
      client_id: tokenBody.client_id,
      redirect_uri: tokenBody.redirect_uri,
    });

    const mpResponse = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(tokenBody),
    });

    const mpResult = await mpResponse.json();

    if (!mpResponse.ok) {
      console.error('[mercadopago-connect] Mercado Pago OAuth error:', JSON.stringify(mpResult));
      throw new Error(mpResult.message || mpResult.error || 'Failed to exchange authorization code');
    }

    console.log('[mercadopago-connect] Token exchange successful, user_id:', mpResult.user_id);

    // Save tokens to database
    const integrationData = {
      user_id: user.id,
      provedor: 'mercadopago',
      access_token: mpResult.access_token,
      refresh_token: mpResult.refresh_token || null,
      mp_user_id: String(mpResult.user_id),
      mp_public_key: mpResult.public_key || null,
      status: 'ativo',
      conectado_em: new Date().toISOString(),
      expira_em: mpResult.expires_in 
        ? new Date(Date.now() + mpResult.expires_in * 1000).toISOString() 
        : null,
      dados_extras: {
        scope: mpResult.scope,
        token_type: mpResult.token_type,
        live_mode: mpResult.live_mode,
      },
    };

    const { data: integration, error: insertError } = await supabase
      .from('usuarios_integracoes')
      .upsert(integrationData, { 
        onConflict: 'user_id,provedor',
        ignoreDuplicates: false 
      })
      .select()
      .single();

    if (insertError) {
      console.error('[mercadopago-connect] Database error:', insertError);
      throw new Error('Failed to save integration');
    }

    console.log('[mercadopago-connect] Integration saved successfully:', integration.id);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Conta Mercado Pago conectada com sucesso',
        integration: {
          id: integration.id,
          status: integration.status,
          mp_user_id: integration.mp_user_id,
          conectado_em: integration.conectado_em,
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[mercadopago-connect] Error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message || 'Erro ao conectar conta Mercado Pago' 
      }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
