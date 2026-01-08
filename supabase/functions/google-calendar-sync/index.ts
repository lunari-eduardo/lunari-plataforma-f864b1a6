import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GOOGLE_CLIENT_ID = Deno.env.get('GOOGLE_CALENDAR_CLIENT_ID');
const GOOGLE_CLIENT_SECRET = Deno.env.get('GOOGLE_CALENDAR_CLIENT_SECRET');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

interface TokenRefreshResult {
  accessToken: string | null;
  error?: 'token_revoked' | 'refresh_failed';
}

async function refreshAccessToken(refreshToken: string): Promise<TokenRefreshResult> {
  try {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID!,
        client_secret: GOOGLE_CLIENT_SECRET!,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    });

    const data = await response.json();
    
    if (data.access_token) {
      return { accessToken: data.access_token };
    }
    
    // Check for revoked token
    if (data.error === 'invalid_grant') {
      console.error('[google-calendar-sync] Token revoked by user:', data.error_description);
      return { accessToken: null, error: 'token_revoked' };
    }
    
    console.error('[google-calendar-sync] Token refresh failed:', data);
    return { accessToken: null, error: 'refresh_failed' };
  } catch (error) {
    console.error('[google-calendar-sync] Token refresh error:', error);
    return { accessToken: null, error: 'refresh_failed' };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { appointmentId, action, userId } = await req.json();

    if (!appointmentId || !action || !userId) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    // Get user's Google Calendar integration
    const { data: integration, error: integrationError } = await supabase
      .from('usuarios_integracoes')
      .select('*')
      .eq('user_id', userId)
      .eq('provedor', 'google_calendar')
      .eq('status', 'ativo')
      .single();

    if (integrationError || !integration) {
      console.log('[google-calendar-sync] No active integration for user:', userId);
      return new Response(JSON.stringify({ synced: false, reason: 'no_integration' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check if sync is enabled
    const syncEnabled = integration.dados_extras?.sync_enabled !== false;
    if (!syncEnabled) {
      console.log('[google-calendar-sync] Sync disabled for user:', userId);
      return new Response(JSON.stringify({ synced: false, reason: 'sync_disabled' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get appointment with client data
    const { data: appointment, error: appointmentError } = await supabase
      .from('appointments')
      .select('*, clientes(nome, telefone, email)')
      .eq('id', appointmentId)
      .single();

    if (appointmentError || !appointment) {
      console.error('[google-calendar-sync] Appointment not found:', appointmentId);
      return new Response(JSON.stringify({ error: 'Appointment not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Only sync confirmed appointments
    if (action !== 'delete' && appointment.status !== 'confirmado') {
      console.log('[google-calendar-sync] Appointment not confirmed, skipping:', appointmentId);
      return new Response(JSON.stringify({ synced: false, reason: 'not_confirmed' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Refresh token if needed
    let accessToken = integration.access_token;
    const expiresAt = new Date(integration.expira_em);
    if (expiresAt <= new Date()) {
      console.log('[google-calendar-sync] Token expired, refreshing...');
      const refreshResult = await refreshAccessToken(integration.refresh_token);
      
      if (!refreshResult.accessToken) {
        // Handle token revocation
        if (refreshResult.error === 'token_revoked') {
          console.error('[google-calendar-sync] Token revoked, marking integration as error');
          
          // Update integration status to error
          await supabase
            .from('usuarios_integracoes')
            .update({ 
              status: 'erro',
              dados_extras: {
                ...integration.dados_extras,
                error: 'token_revoked',
                error_at: new Date().toISOString(),
              },
              updated_at: new Date().toISOString(),
            })
            .eq('id', integration.id);
          
          // Mark appointment for retry
          await supabase
            .from('appointments')
            .update({ google_sync_status: 'pending' })
            .eq('id', appointmentId);
          
          return new Response(JSON.stringify({ 
            error: 'Token revoked, user needs to reconnect',
            needs_reconnect: true 
          }), {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        
        // Mark for retry on other failures
        await supabase
          .from('appointments')
          .update({ google_sync_status: 'pending' })
          .eq('id', appointmentId);
        
        return new Response(JSON.stringify({ error: 'Token refresh failed' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      accessToken = refreshResult.accessToken;
      
      // Update token in database
      await supabase
        .from('usuarios_integracoes')
        .update({ 
          access_token: accessToken,
          expira_em: new Date(Date.now() + 3600 * 1000).toISOString()
        })
        .eq('id', integration.id);
    }

    const calendarId = integration.dados_extras?.calendar_id || 'primary';
    const googleEventId = appointment.google_event_id;

    // Format event data - Use client name as title for consistency
    const clientName = appointment.clientes?.nome || appointment.title;
    const eventData = {
      summary: clientName, // Just the client name for cleaner display
      description: [
        `📋 ${appointment.type}`,
        appointment.description,
        appointment.clientes?.telefone ? `📞 ${appointment.clientes.telefone}` : '',
        appointment.clientes?.email ? `📧 ${appointment.clientes.email}` : '',
        '',
        '⚠️ Este evento é gerenciado pelo Lunari. Alterações aqui não afetam o Lunari.',
      ].filter(Boolean).join('\n'),
      start: {
        dateTime: `${appointment.date}T${appointment.time}:00`,
        timeZone: 'America/Sao_Paulo',
      },
      end: {
        // Assume 1 hour duration by default
        dateTime: `${appointment.date}T${addHour(appointment.time)}:00`,
        timeZone: 'America/Sao_Paulo',
      },
      colorId: '9', // Blue
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'popup', minutes: 60 },
          { method: 'popup', minutes: 1440 }, // 1 day
        ],
      },
    };

    let response: Response;
    let newEventId: string | null = null;
    let syncStatus: string = 'synced';

    if (action === 'delete' && googleEventId) {
      // Delete event
      response = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${googleEventId}`,
        {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${accessToken}` },
        }
      );
      syncStatus = 'deleted';
      console.log('[google-calendar-sync] Deleted event:', googleEventId);

    } else if (googleEventId) {
      // Update event
      response = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${googleEventId}`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(eventData),
        }
      );
      console.log('[google-calendar-sync] Updated event:', googleEventId);

    } else {
      // Create new event
      response = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(eventData),
        }
      );

      if (response.ok) {
        const eventResult = await response.json();
        newEventId = eventResult.id;
        console.log('[google-calendar-sync] Created event:', newEventId);
      }
    }

    if (!response.ok && response.status !== 410) { // 410 = already deleted
      const errorData = await response.json().catch(() => ({}));
      console.error('[google-calendar-sync] Google API error:', response.status, errorData);
      syncStatus = 'error';
    }

    // Update appointment with sync status
    const updateData: any = { google_sync_status: syncStatus };
    if (newEventId) {
      updateData.google_event_id = newEventId;
    }
    if (action === 'delete') {
      updateData.google_event_id = null;
    }

    await supabase
      .from('appointments')
      .update(updateData)
      .eq('id', appointmentId);

    return new Response(JSON.stringify({ 
      synced: syncStatus === 'synced' || syncStatus === 'deleted',
      status: syncStatus,
      eventId: newEventId || googleEventId 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[google-calendar-sync] Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function addHour(time: string): string {
  const [hours, minutes] = time.split(':').map(Number);
  const newHours = (hours + 1) % 24;
  return `${String(newHours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}
