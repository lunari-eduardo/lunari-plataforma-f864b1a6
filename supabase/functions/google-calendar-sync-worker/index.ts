// Worker invoked by pg_cron every minute to drain the google_calendar_sync_queue
import {
  corsHeaders,
  buildEventBody,
  ensureValidAccessToken,
  backoffMinutes,
  makeSupabaseService,
} from '../_shared/google-calendar.ts';

const BATCH_SIZE = 25;
const MAX_ATTEMPTS = 6;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = makeSupabaseService();

    // Pega itens pendentes prontos para processar
    const { data: items, error: fetchErr } = await supabase
      .from('google_calendar_sync_queue')
      .select('*')
      .is('processed_at', null)
      .lte('next_attempt_at', new Date().toISOString())
      .lt('attempts', MAX_ATTEMPTS)
      .order('next_attempt_at', { ascending: true })
      .limit(BATCH_SIZE);

    if (fetchErr) {
      console.error('[worker] Fetch queue error:', fetchErr);
      return jsonResponse({ error: 'fetch_failed' }, 500);
    }

    if (!items || items.length === 0) {
      return jsonResponse({ processed: 0 });
    }

    console.log(`[worker] Processing ${items.length} queue items`);

    const integrationCache = new Map<string, any>();
    const tokenCache = new Map<string, string | null>();

    let processed = 0;
    let succeeded = 0;
    let failed = 0;

    for (const item of items) {
      processed++;
      try {
        // Carrega integração (cache por usuário)
        let integration = integrationCache.get(item.user_id);
        if (!integration) {
          const { data } = await supabase
            .from('usuarios_integracoes')
            .select('*')
            .eq('user_id', item.user_id)
            .eq('provedor', 'google_calendar')
            .maybeSingle();
          integration = data;
          integrationCache.set(item.user_id, data);
        }

        // Sem integração ativa → marca processado e segue (evita backlog inútil)
        if (!integration || integration.status !== 'ativo') {
          await markProcessed(supabase, item.id, 'skipped: no active integration');
          continue;
        }
        const syncEnabled = integration.dados_extras?.sync_enabled !== false;
        if (!syncEnabled) {
          await markProcessed(supabase, item.id, 'skipped: sync disabled');
          continue;
        }

        // Token válido (cache por usuário)
        let accessToken = tokenCache.get(item.user_id);
        if (accessToken === undefined) {
          const tk = await ensureValidAccessToken(supabase, integration);
          if (tk.revoked) {
            tokenCache.set(item.user_id, null);
            await markFailedTerminal(supabase, item.id, 'token_revoked');
            failed++;
            continue;
          }
          accessToken = tk.accessToken;
          tokenCache.set(item.user_id, accessToken);
        }

        if (!accessToken) {
          await scheduleRetry(supabase, item, 'token_refresh_failed');
          failed++;
          continue;
        }

        const calendarId = integration.dados_extras?.calendar_id || 'primary';

        // ----- DELETE -----
        if (item.action === 'delete') {
          const eventId = item.payload?.google_event_id;
          if (!eventId) {
            await markProcessed(supabase, item.id, 'no event id');
            succeeded++;
            continue;
          }
          const res = await fetch(
            `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${eventId}`,
            { method: 'DELETE', headers: { Authorization: `Bearer ${accessToken}` } },
          );
          if (res.ok || res.status === 410 || res.status === 404) {
            await markProcessed(supabase, item.id, null);
            succeeded++;
          } else {
            const txt = await res.text();
            await scheduleRetry(supabase, item, `delete ${res.status}: ${txt.slice(0, 200)}`);
            failed++;
          }
          continue;
        }

        // ----- CREATE / UPDATE -----
        const { data: appt, error: apptErr } = await supabase
          .from('appointments')
          .select('*, clientes(nome, telefone, email)')
          .eq('id', item.appointment_id)
          .maybeSingle();

        if (apptErr || !appt) {
          await markProcessed(supabase, item.id, 'appointment not found');
          continue;
        }

        // Apenas confirmados são sincronizados
        if (appt.status !== 'confirmado') {
          await markProcessed(supabase, item.id, 'not confirmed');
          continue;
        }

        const body = buildEventBody(appt);
        let response: Response;
        let createdEventId: string | null = null;

        if (appt.google_event_id) {
          // UPDATE
          response = await fetch(
            `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${appt.google_event_id}`,
            {
              method: 'PUT',
              headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(body),
            },
          );
          // Se 404/410, evento foi removido externamente — re-cria
          if (response.status === 404 || response.status === 410) {
            response = await fetch(
              `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`,
              {
                method: 'POST',
                headers: {
                  Authorization: `Bearer ${accessToken}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify(body),
              },
            );
            if (response.ok) {
              const json = await response.json();
              createdEventId = json.id;
            }
          }
        } else {
          // CREATE
          response = await fetch(
            `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`,
            {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(body),
            },
          );
          if (response.ok) {
            const json = await response.json();
            createdEventId = json.id;
          }
        }

        if (response.ok) {
          const update: any = { google_sync_status: 'synced' };
          if (createdEventId) update.google_event_id = createdEventId;
          await supabase.from('appointments').update(update).eq('id', appt.id);
          await markProcessed(supabase, item.id, null);
          succeeded++;
        } else {
          const txt = await response.text();
          await supabase
            .from('appointments')
            .update({ google_sync_status: 'error' })
            .eq('id', appt.id);
          await scheduleRetry(supabase, item, `${response.status}: ${txt.slice(0, 200)}`);
          failed++;
        }
      } catch (e: any) {
        console.error('[worker] Item error:', e);
        await scheduleRetry(supabase, item, e?.message || 'unknown error');
        failed++;
      }
    }

    console.log(`[worker] Done. processed=${processed} ok=${succeeded} fail=${failed}`);
    return jsonResponse({ processed, succeeded, failed });
  } catch (e: any) {
    console.error('[worker] Fatal:', e);
    return jsonResponse({ error: e?.message || 'fatal' }, 500);
  }
});

function jsonResponse(body: any, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function markProcessed(supabase: any, id: string, note: string | null) {
  await supabase
    .from('google_calendar_sync_queue')
    .update({ processed_at: new Date().toISOString(), last_error: note })
    .eq('id', id);
}

async function markFailedTerminal(supabase: any, id: string, reason: string) {
  await supabase
    .from('google_calendar_sync_queue')
    .update({
      processed_at: new Date().toISOString(),
      last_error: `terminal: ${reason}`,
      attempts: MAX_ATTEMPTS,
    })
    .eq('id', id);
}

async function scheduleRetry(supabase: any, item: any, error: string) {
  const nextAttempts = (item.attempts || 0) + 1;
  if (nextAttempts >= MAX_ATTEMPTS) {
    await supabase
      .from('google_calendar_sync_queue')
      .update({
        attempts: nextAttempts,
        last_error: error,
        processed_at: new Date().toISOString(),
      })
      .eq('id', item.id);
    return;
  }
  const delay = backoffMinutes(nextAttempts);
  const next = new Date(Date.now() + delay * 60_000).toISOString();
  await supabase
    .from('google_calendar_sync_queue')
    .update({
      attempts: nextAttempts,
      last_error: error,
      next_attempt_at: next,
    })
    .eq('id', item.id);
}
