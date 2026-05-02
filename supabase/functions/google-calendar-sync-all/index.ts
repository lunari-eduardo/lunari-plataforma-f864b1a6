import {
  corsHeaders,
  buildEventBody,
  ensureValidAccessToken,
  makeSupabaseService,
} from '../_shared/google-calendar.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

interface SyncResult {
  total: number;
  synced: number;
  updated: number;
  failed: number;
  errors: string[];
  needs_reconnect?: boolean;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return jsonResponse({ error: 'Missing authorization header' }, 401);

    // Validar usuário
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) return jsonResponse({ error: 'Invalid token' }, 401);

    const supabase = makeSupabaseService();

    const { data: integration } = await supabase
      .from('usuarios_integracoes')
      .select('*')
      .eq('user_id', user.id)
      .eq('provedor', 'google_calendar')
      .eq('status', 'ativo')
      .maybeSingle();

    if (!integration) {
      return jsonResponse({ error: 'Google Calendar não está conectado' }, 400);
    }

    const syncEnabled = (integration.dados_extras as any)?.sync_enabled !== false;
    if (!syncEnabled) {
      return jsonResponse({ error: 'Sincronização está desativada' }, 400);
    }

    const calendarId = (integration.dados_extras as any)?.calendar_id;
    if (!calendarId) return jsonResponse({ error: 'Calendar ID não encontrado' }, 400);

    const tk = await ensureValidAccessToken(supabase, integration);
    if (tk.revoked) {
      return jsonResponse(
        { error: 'Token revogado. Reconecte o Google Calendar.', needs_reconnect: true },
        401,
      );
    }
    if (!tk.accessToken) {
      return jsonResponse({ error: 'Falha ao renovar token do Google' }, 500);
    }
    const accessToken = tk.accessToken;

    const today = new Date().toISOString().split('T')[0];

    // Buscar appointments confirmados de hoje em diante que precisam sync
    const { data: appointments, error: apptErr } = await supabase
      .from('appointments')
      .select('*, clientes(nome, email, telefone)')
      .eq('user_id', user.id)
      .eq('status', 'confirmado')
      .gte('date', today)
      .or('google_event_id.is.null,google_sync_status.in.(pending,error)')
      .order('date', { ascending: true });

    if (apptErr) {
      console.error('[sync-all] Fetch error:', apptErr);
      return jsonResponse({ error: 'Erro ao buscar agendamentos' }, 500);
    }

    const result: SyncResult = {
      total: appointments?.length || 0,
      synced: 0,
      updated: 0,
      failed: 0,
      errors: [],
    };

    for (const appt of appointments || []) {
      const clientName = appt.clientes?.nome || appt.title;
      try {
        const body = buildEventBody(appt);
        let response: Response;
        let createdEventId: string | null = null;
        let isUpdate = false;

        if (appt.google_event_id) {
          isUpdate = true;
          response = await fetch(
            `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${appt.google_event_id}`,
            {
              method: 'PUT',
              headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
              body: JSON.stringify(body),
            },
          );
          if (response.status === 404 || response.status === 410) {
            // Evento removido externamente — recria
            isUpdate = false;
            response = await fetch(
              `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`,
              {
                method: 'POST',
                headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
              },
            );
            if (response.ok) {
              const j = await response.json();
              createdEventId = j.id;
            }
          }
        } else {
          response = await fetch(
            `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`,
            {
              method: 'POST',
              headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
              body: JSON.stringify(body),
            },
          );
          if (response.ok) {
            const j = await response.json();
            createdEventId = j.id;
          }
        }

        if (!response.ok) {
          const txt = await response.text();
          console.error(`[sync-all] Failed for ${appt.id}:`, txt);
          result.failed++;
          result.errors.push(`${clientName}: ${txt.slice(0, 200)}`);
          await supabase
            .from('appointments')
            .update({ google_sync_status: 'error' })
            .eq('id', appt.id);
          continue;
        }

        const update: any = { google_sync_status: 'synced' };
        if (createdEventId) update.google_event_id = createdEventId;

        await supabase.from('appointments').update(update).eq('id', appt.id);

        if (isUpdate) result.updated++;
        else result.synced++;
      } catch (e: any) {
        console.error(`[sync-all] Error appt ${appt.id}:`, e);
        result.failed++;
        result.errors.push(`${clientName}: ${e?.message || 'erro'}`);
      }
    }

    console.log(`[sync-all] Done: created=${result.synced} updated=${result.updated} failed=${result.failed}`);
    return jsonResponse(result);
  } catch (error: any) {
    console.error('[sync-all] Fatal:', error);
    return jsonResponse({ error: error?.message || 'fatal' }, 500);
  }
});

function jsonResponse(body: any, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
