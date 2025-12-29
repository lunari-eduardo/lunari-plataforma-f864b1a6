import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL');

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate auth
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      SUPABASE_URL!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get current integration to revoke token
    const { data: integration } = await supabase
      .from('usuarios_integracoes')
      .select('access_token')
      .eq('user_id', user.id)
      .eq('provedor', 'google_calendar')
      .single();

    if (integration?.access_token) {
      // Revoke the token at Google
      try {
        await fetch(`https://oauth2.googleapis.com/revoke?token=${integration.access_token}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        });
        console.log('[google-calendar-disconnect] Token revoked');
      } catch (e) {
        console.warn('[google-calendar-disconnect] Token revoke failed:', e);
      }
    }

    // Delete integration record
    const { error: deleteError } = await supabase
      .from('usuarios_integracoes')
      .delete()
      .eq('user_id', user.id)
      .eq('provedor', 'google_calendar');

    if (deleteError) {
      console.error('[google-calendar-disconnect] Delete error:', deleteError);
      return new Response(JSON.stringify({ error: 'Failed to disconnect' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Clear google_event_id from appointments
    const supabaseServiceRole = createClient(
      SUPABASE_URL!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    await supabaseServiceRole
      .from('appointments')
      .update({ 
        google_event_id: null, 
        google_sync_status: null 
      })
      .eq('user_id', user.id);

    console.log('[google-calendar-disconnect] Integration removed for user:', user.id);

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[google-calendar-disconnect] Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
