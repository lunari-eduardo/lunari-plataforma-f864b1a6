// Shared helpers for Google Calendar sync edge functions
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, DELETE, PUT',
};

export interface TokenRefreshResult {
  accessToken: string | null;
  expiresIn?: number;
  error?: 'token_revoked' | 'refresh_failed';
}

export async function refreshAccessToken(
  refreshToken: string,
  clientId: string,
  clientSecret: string,
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
      return { accessToken: data.access_token, expiresIn: data.expires_in ?? 3600 };
    }
    if (data.error === 'invalid_grant') {
      return { accessToken: null, error: 'token_revoked' };
    }
    console.error('[gcal] Token refresh failed:', data);
    return { accessToken: null, error: 'refresh_failed' };
  } catch (e) {
    console.error('[gcal] Token refresh error:', e);
    return { accessToken: null, error: 'refresh_failed' };
  }
}

export function addMinutes(time: string, minutes: number): string {
  const [h, m] = time.split(':').map(Number);
  const total = h * 60 + m + minutes;
  const newH = Math.floor(total / 60) % 24;
  const newM = total % 60;
  return `${String(newH).padStart(2, '0')}:${String(newM).padStart(2, '0')}`;
}

export function buildEventBody(appointment: any): any {
  const clientName = appointment.clientes?.nome || appointment.title || 'Agendamento';
  const duration = Number(appointment.duration_minutes) > 0
    ? Number(appointment.duration_minutes)
    : 60;

  const description = [
    `📋 ${appointment.type || ''}`.trim(),
    appointment.description,
    appointment.clientes?.telefone ? `📞 ${appointment.clientes.telefone}` : '',
    appointment.clientes?.email ? `📧 ${appointment.clientes.email}` : '',
    '',
    '⚠️ Este evento é gerenciado pelo Lunari. Alterações aqui não afetam o Lunari.',
  ].filter(Boolean).join('\n');

  return {
    summary: clientName,
    description,
    start: {
      dateTime: `${appointment.date}T${appointment.time}:00`,
      timeZone: 'America/Sao_Paulo',
    },
    end: {
      dateTime: `${appointment.date}T${addMinutes(appointment.time, duration)}:00`,
      timeZone: 'America/Sao_Paulo',
    },
    colorId: '9',
    reminders: {
      useDefault: false,
      overrides: [
        { method: 'popup', minutes: 60 },
        { method: 'popup', minutes: 1440 },
      ],
    },
  };
}

/**
 * Ensures we have a valid access token. Updates the integration row if refreshed.
 * Returns null if integration is broken (and marks it as 'erro' if revoked).
 */
export async function ensureValidAccessToken(
  supabase: SupabaseClient,
  integration: any,
): Promise<{ accessToken: string | null; revoked: boolean }> {
  const expiresAt = integration.expira_em ? new Date(integration.expira_em) : new Date(0);
  // Refresh 60s antes para evitar borda
  if (expiresAt.getTime() - 60_000 > Date.now()) {
    return { accessToken: integration.access_token, revoked: false };
  }

  const clientId = Deno.env.get('GOOGLE_CALENDAR_CLIENT_ID')!;
  const clientSecret = Deno.env.get('GOOGLE_CALENDAR_CLIENT_SECRET')!;
  const result = await refreshAccessToken(integration.refresh_token, clientId, clientSecret);

  if (!result.accessToken) {
    if (result.error === 'token_revoked') {
      await supabase
        .from('usuarios_integracoes')
        .update({
          status: 'erro',
          dados_extras: {
            ...(integration.dados_extras || {}),
            error: 'token_revoked',
            error_at: new Date().toISOString(),
          },
          updated_at: new Date().toISOString(),
        })
        .eq('id', integration.id);
      return { accessToken: null, revoked: true };
    }
    return { accessToken: null, revoked: false };
  }

  const newExpiry = new Date(Date.now() + (result.expiresIn ?? 3600) * 1000).toISOString();
  await supabase
    .from('usuarios_integracoes')
    .update({
      access_token: result.accessToken,
      expira_em: newExpiry,
      updated_at: new Date().toISOString(),
    })
    .eq('id', integration.id);

  return { accessToken: result.accessToken, revoked: false };
}

export function backoffMinutes(attempts: number): number {
  // 1, 5, 15, 60, 360 minutes
  const schedule = [1, 5, 15, 60, 360];
  return schedule[Math.min(attempts, schedule.length - 1)];
}

export function makeSupabaseService(): SupabaseClient {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );
}
