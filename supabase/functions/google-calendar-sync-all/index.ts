import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SyncResult {
  total: number;
  synced: number;
  failed: number;
  errors: string[];
  needs_reconnect?: boolean;
}

interface TokenRefreshResult {
  accessToken: string | null;
  error?: 'token_revoked' | 'refresh_failed';
}

async function refreshAccessToken(
  refreshToken: string,
  clientId: string,
  clientSecret: string
): Promise<TokenRefreshResult> {
  try {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
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
      console.error('[google-calendar-sync-all] Token revoked by user:', data.error_description);
      return { accessToken: null, error: 'token_revoked' };
    }
    
    console.error('[google-calendar-sync-all] Token refresh failed:', data);
    return { accessToken: null, error: 'refresh_failed' };
  } catch (error) {
    console.error('[google-calendar-sync-all] Token refresh error:', error);
    return { accessToken: null, error: 'refresh_failed' };
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get user from token
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      console.error('[google-calendar-sync-all] User error:', userError);
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[google-calendar-sync-all] Starting sync for user: ${user.id}`);

    // Get user's Google Calendar integration
    const { data: integration, error: integrationError } = await supabase
      .from('usuarios_integracoes')
      .select('*')
      .eq('user_id', user.id)
      .eq('provedor', 'google_calendar')
      .eq('status', 'ativo')
      .maybeSingle();

    if (integrationError || !integration) {
      console.log('[google-calendar-sync-all] No active integration found');
      return new Response(
        JSON.stringify({ error: 'Google Calendar não está conectado' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if sync is enabled
    const syncEnabled = (integration.dados_extras as any)?.sync_enabled !== false;
    if (!syncEnabled) {
      return new Response(
        JSON.stringify({ error: 'Sincronização está desativada' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const calendarId = (integration.dados_extras as any)?.calendar_id;
    if (!calendarId) {
      return new Response(
        JSON.stringify({ error: 'Calendar ID não encontrado' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check token expiration and refresh if needed
    let accessToken = integration.access_token;
    const expiresAt = integration.expira_em ? new Date(integration.expira_em) : null;
    
    if (expiresAt && expiresAt <= new Date()) {
      console.log('[google-calendar-sync-all] Token expired, refreshing...');
      
      const clientId = Deno.env.get('GOOGLE_CALENDAR_CLIENT_ID')!;
      const clientSecret = Deno.env.get('GOOGLE_CALENDAR_CLIENT_SECRET')!;
      
      const refreshResult = await refreshAccessToken(
        integration.refresh_token!,
        clientId,
        clientSecret
      );

      if (!refreshResult.accessToken) {
        // Handle token revocation
        if (refreshResult.error === 'token_revoked') {
          console.error('[google-calendar-sync-all] Token revoked, marking integration as error');
          
          // Update integration status to error
          await supabase
            .from('usuarios_integracoes')
            .update({ 
              status: 'erro',
              dados_extras: {
                ...(integration.dados_extras as any),
                error: 'token_revoked',
                error_at: new Date().toISOString(),
              },
              updated_at: new Date().toISOString(),
            })
            .eq('id', integration.id);
          
          return new Response(
            JSON.stringify({ 
              error: 'Token revogado. Por favor, reconecte o Google Calendar.',
              needs_reconnect: true 
            }),
            { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        console.error('[google-calendar-sync-all] Token refresh failed');
        return new Response(
          JSON.stringify({ error: 'Falha ao renovar token do Google' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      accessToken = refreshResult.accessToken;

      // Update token in database
      await supabase
        .from('usuarios_integracoes')
        .update({
          access_token: accessToken,
          expira_em: new Date(Date.now() + 3600 * 1000).toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', integration.id);
    }

    // Get today's date in YYYY-MM-DD format
    const today = new Date().toISOString().split('T')[0];

    // Fetch confirmed appointments from today onwards that don't have google_event_id
    // Also include appointments with pending or error status
    const { data: appointments, error: appointmentsError } = await supabase
      .from('appointments')
      .select('*, clientes(nome, email, telefone)')
      .eq('user_id', user.id)
      .eq('status', 'confirmado')
      .gte('date', today)
      .or('google_event_id.is.null,google_sync_status.eq.pending,google_sync_status.eq.error')
      .order('date', { ascending: true });

    if (appointmentsError) {
      console.error('[google-calendar-sync-all] Error fetching appointments:', appointmentsError);
      return new Response(
        JSON.stringify({ error: 'Erro ao buscar agendamentos' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[google-calendar-sync-all] Found ${appointments?.length || 0} appointments to sync`);

    const result: SyncResult = {
      total: appointments?.length || 0,
      synced: 0,
      failed: 0,
      errors: [],
    };

    if (!appointments || appointments.length === 0) {
      return new Response(
        JSON.stringify(result),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Sync each appointment
    for (const appointment of appointments) {
      try {
        // Parse time (HH:mm format)
        const [hours, minutes] = appointment.time.split(':').map(Number);
        
        // Create start and end datetime
        const startDate = new Date(`${appointment.date}T${appointment.time}:00`);
        const endDate = new Date(startDate.getTime() + 60 * 60 * 1000); // +1 hour

        // Use client name as summary for cleaner display (consistent with google-calendar-sync)
        const clientName = appointment.clientes?.nome || appointment.title;

        // Build event description
        const descriptionParts = [
          `📋 ${appointment.type}`,
          appointment.description,
          appointment.clientes?.telefone ? `📞 ${appointment.clientes.telefone}` : '',
          appointment.clientes?.email ? `📧 ${appointment.clientes.email}` : '',
          '',
          '⚠️ Este evento é gerenciado pelo Lunari. Alterações aqui não afetam o Lunari.',
        ].filter(Boolean);

        const event = {
          summary: clientName,
          description: descriptionParts.join('\n'),
          start: {
            dateTime: startDate.toISOString(),
            timeZone: 'America/Sao_Paulo',
          },
          end: {
            dateTime: endDate.toISOString(),
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

        // Create event in Google Calendar
        const createResponse = await fetch(
          `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(event),
          }
        );

        if (!createResponse.ok) {
          const errorText = await createResponse.text();
          console.error(`[google-calendar-sync-all] Failed to create event for ${appointment.id}:`, errorText);
          result.failed++;
          result.errors.push(`${clientName}: ${errorText}`);
          
          // Mark as error
          await supabase
            .from('appointments')
            .update({
              google_sync_status: 'error',
              updated_at: new Date().toISOString(),
            })
            .eq('id', appointment.id);
          
          continue;
        }

        const createdEvent = await createResponse.json();
        console.log(`[google-calendar-sync-all] Created event: ${createdEvent.id} for appointment ${appointment.id}`);

        // Update appointment with google_event_id
        const { error: updateError } = await supabase
          .from('appointments')
          .update({
            google_event_id: createdEvent.id,
            google_sync_status: 'synced',
            updated_at: new Date().toISOString(),
          })
          .eq('id', appointment.id);

        if (updateError) {
          console.error(`[google-calendar-sync-all] Failed to update appointment ${appointment.id}:`, updateError);
          result.failed++;
          result.errors.push(`${clientName}: Erro ao atualizar banco de dados`);
        } else {
          result.synced++;
        }
      } catch (error) {
        console.error(`[google-calendar-sync-all] Error syncing appointment ${appointment.id}:`, error);
        result.failed++;
        result.errors.push(`${appointment.clientes?.nome || appointment.title}: ${error.message}`);
      }
    }

    console.log(`[google-calendar-sync-all] Sync completed: ${result.synced}/${result.total} synced, ${result.failed} failed`);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[google-calendar-sync-all] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
