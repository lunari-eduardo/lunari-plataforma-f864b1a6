import {
  corsHeaders,
  buildEventBody,
  ensureValidAccessToken,
  makeSupabaseService,
} from '../_shared/google-calendar.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { appointmentId, action, userId } = await req.json();

    if (!appointmentId || !action || !userId) {
      return jsonResponse({ error: 'Missing required fields' }, 400);
    }

    const supabase = makeSupabaseService();

    const { data: integration } = await supabase
      .from('usuarios_integracoes')
      .select('*')
      .eq('user_id', userId)
      .eq('provedor', 'google_calendar')
      .eq('status', 'ativo')
      .maybeSingle();

    if (!integration) {
      return jsonResponse({ synced: false, reason: 'no_integration' });
    }

    const syncEnabled = integration.dados_extras?.sync_enabled !== false;
    if (!syncEnabled) {
      return jsonResponse({ synced: false, reason: 'sync_disabled' });
    }

    const { data: appointment } = await supabase
      .from('appointments')
      .select('*, clientes(nome, telefone, email)')
      .eq('id', appointmentId)
      .maybeSingle();

    if (!appointment) {
      return jsonResponse({ error: 'Appointment not found' }, 404);
    }

    if (action !== 'delete' && appointment.status !== 'confirmado') {
      return jsonResponse({ synced: false, reason: 'not_confirmed' });
    }

    const tk = await ensureValidAccessToken(supabase, integration);
    if (tk.revoked) {
      await supabase
        .from('appointments')
        .update({ google_sync_status: 'pending' })
        .eq('id', appointmentId);
      return jsonResponse({ error: 'Token revoked', needs_reconnect: true }, 401);
    }
    if (!tk.accessToken) {
      await supabase
        .from('appointments')
        .update({ google_sync_status: 'pending' })
        .eq('id', appointmentId);
      return jsonResponse({ error: 'Token refresh failed' }, 401);
    }

    const accessToken = tk.accessToken;
    const calendarId = integration.dados_extras?.calendar_id || 'primary';
    const googleEventId = appointment.google_event_id;

    let response: Response;
    let newEventId: string | null = null;
    let syncStatus = 'synced';

    if (action === 'delete' && googleEventId) {
      response = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${googleEventId}`,
        { method: 'DELETE', headers: { Authorization: `Bearer ${accessToken}` } },
      );
      syncStatus = 'deleted';
    } else if (googleEventId) {
      response = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${googleEventId}`,
        {
          method: 'PUT',
          headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(buildEventBody(appointment)),
        },
      );
      // Se evento foi removido externamente, recria
      if (response.status === 404 || response.status === 410) {
        response = await fetch(
          `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`,
          {
            method: 'POST',
            headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(buildEventBody(appointment)),
          },
        );
        if (response.ok) {
          const json = await response.json();
          newEventId = json.id;
        }
      }
    } else {
      response = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(buildEventBody(appointment)),
        },
      );
      if (response.ok) {
        const json = await response.json();
        newEventId = json.id;
      }
    }

    if (!response.ok && response.status !== 410) {
      const errorData = await response.json().catch(() => ({}));
      console.error('[google-calendar-sync] Google API error:', response.status, errorData);
      syncStatus = 'error';
    }

    const updateData: any = { google_sync_status: syncStatus };
    if (newEventId) updateData.google_event_id = newEventId;
    if (action === 'delete') updateData.google_event_id = null;

    await supabase.from('appointments').update(updateData).eq('id', appointmentId);

    return jsonResponse({
      synced: syncStatus === 'synced' || syncStatus === 'deleted',
      status: syncStatus,
      eventId: newEventId || googleEventId,
    });
  } catch (error: any) {
    console.error('[google-calendar-sync] Error:', error);
    return jsonResponse({ error: error?.message || 'unknown' }, 500);
  }
});

function jsonResponse(body: any, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
