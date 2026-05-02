import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, ensureValidAccessToken } from '../_shared/google-calendar.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }

    const userClient = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) return jsonResponse({ error: 'Unauthorized' }, 401);

    let removeRemoteEvents = false;
    try {
      const body = await req.json();
      removeRemoteEvents = body?.removeRemoteEvents === true;
    } catch (_) {
      // no body, default false
    }

    const serviceClient = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    const { data: integration } = await serviceClient
      .from('usuarios_integracoes')
      .select('*')
      .eq('user_id', user.id)
      .eq('provedor', 'google_calendar')
      .maybeSingle();

    // Remover eventos remotos antes de revogar token
    let removedCount = 0;
    if (removeRemoteEvents && integration) {
      try {
        const tk = await ensureValidAccessToken(serviceClient, integration);
        const accessToken = tk.accessToken;
        const calendarId = integration.dados_extras?.calendar_id || 'primary';

        if (accessToken) {
          const { data: appts } = await serviceClient
            .from('appointments')
            .select('id, google_event_id')
            .eq('user_id', user.id)
            .not('google_event_id', 'is', null);

          for (const a of appts || []) {
            try {
              const r = await fetch(
                `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${a.google_event_id}`,
                { method: 'DELETE', headers: { Authorization: `Bearer ${accessToken}` } },
              );
              if (r.ok || r.status === 404 || r.status === 410) removedCount++;
            } catch (_) {
              // ignora falhas individuais
            }
          }
        }
      } catch (e) {
        console.warn('[disconnect] Falha ao remover eventos:', e);
      }
    }

    if (integration?.access_token) {
      try {
        await fetch(`https://oauth2.googleapis.com/revoke?token=${integration.access_token}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        });
      } catch (e) {
        console.warn('[disconnect] Token revoke failed:', e);
      }
    }

    await serviceClient
      .from('usuarios_integracoes')
      .delete()
      .eq('user_id', user.id)
      .eq('provedor', 'google_calendar');

    await serviceClient
      .from('appointments')
      .update({ google_event_id: null, google_sync_status: null })
      .eq('user_id', user.id);

    // Limpa fila pendente do usuário
    await serviceClient
      .from('google_calendar_sync_queue')
      .delete()
      .eq('user_id', user.id)
      .is('processed_at', null);

    return jsonResponse({ success: true, removedRemoteEvents: removedCount });
  } catch (error: any) {
    console.error('[google-calendar-disconnect] Error:', error);
    return jsonResponse({ error: error?.message || 'unknown' }, 500);
  }
});

function jsonResponse(body: any, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
