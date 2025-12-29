import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const GOOGLE_CLIENT_ID = Deno.env.get('GOOGLE_CALENDAR_CLIENT_ID');
const GOOGLE_CLIENT_SECRET = Deno.env.get('GOOGLE_CALENDAR_CLIENT_SECRET');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

serve(async (req) => {
  try {
    const url = new URL(req.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const error = url.searchParams.get('error');

    // Parse state to get user info and redirect
    let stateData: { userId: string; redirectUri: string } | null = null;
    try {
      if (state) {
        stateData = JSON.parse(atob(state));
      }
    } catch (e) {
      console.error('[google-calendar-callback] Failed to parse state:', e);
    }

    // Use absolute URL for redirect - fallback to production URL
    const defaultRedirect = 'https://www.lunariplataforma.com.br/app/preferencias?tab=integracoes';
    const redirectUri = stateData?.redirectUri || defaultRedirect;

    if (error) {
      console.error('[google-calendar-callback] OAuth error:', error);
      return Response.redirect(`${redirectUri}?google_error=${error}`, 302);
    }

    if (!code || !stateData?.userId) {
      console.error('[google-calendar-callback] Missing code or userId');
      return Response.redirect(`${redirectUri}?google_error=missing_params`, 302);
    }

    // Exchange code for tokens
    const callbackUrl = `${SUPABASE_URL}/functions/v1/google-calendar-callback`;
    
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: GOOGLE_CLIENT_ID!,
        client_secret: GOOGLE_CLIENT_SECRET!,
        redirect_uri: callbackUrl,
        grant_type: 'authorization_code',
      }),
    });

    const tokenData = await tokenResponse.json();

    if (tokenData.error) {
      console.error('[google-calendar-callback] Token exchange error:', tokenData);
      return Response.redirect(`${redirectUri}?google_error=token_exchange_failed`, 302);
    }

    console.log('[google-calendar-callback] Token exchange successful');

    // Create Lunari calendar in Google Calendar
    const calendarResponse = await fetch('https://www.googleapis.com/calendar/v3/calendars', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        summary: 'Lunari – Agenda',
        description: 'Eventos sincronizados automaticamente do Lunari',
        timeZone: 'America/Sao_Paulo',
      }),
    });

    let calendarId = 'primary';
    if (calendarResponse.ok) {
      const calendarData = await calendarResponse.json();
      calendarId = calendarData.id;
      console.log('[google-calendar-callback] Created Lunari calendar:', calendarId);
    } else {
      console.warn('[google-calendar-callback] Could not create calendar, using primary');
    }

    // Calculate expiration
    const expiresAt = new Date(Date.now() + (tokenData.expires_in * 1000)).toISOString();

    // Save to database using service role
    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    const { error: upsertError } = await supabase
      .from('usuarios_integracoes')
      .upsert({
        user_id: stateData.userId,
        provedor: 'google_calendar',
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        expira_em: expiresAt,
        conectado_em: new Date().toISOString(),
        status: 'ativo',
        dados_extras: {
          calendar_id: calendarId,
          sync_enabled: true,
        },
      }, {
        onConflict: 'user_id,provedor',
      });

    if (upsertError) {
      console.error('[google-calendar-callback] Database error:', upsertError);
      return Response.redirect(`${redirectUri}?google_error=database_error`, 302);
    }

    console.log('[google-calendar-callback] Integration saved for user:', stateData.userId);

    return Response.redirect(`${redirectUri}?google_success=true`, 302);

  } catch (error) {
    console.error('[google-calendar-callback] Error:', error);
    return Response.redirect('https://www.lunariplataforma.com.br/app/preferencias?tab=integracoes&google_error=unknown', 302);
  }
});
