import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const GOOGLE_CLIENT_ID = Deno.env.get('GOOGLE_CALENDAR_CLIENT_ID');
const GOOGLE_CLIENT_SECRET = Deno.env.get('GOOGLE_CALENDAR_CLIENT_SECRET');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

const admin = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

/** Adiciona parâmetros a uma URL que pode ou não já ter query string. */
function withParams(base: string, params: Record<string, string>): string {
  const url = new URL(base);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return url.toString();
}

/** Log persistente — nunca grava tokens brutos. */
async function logStep(
  userId: string | null,
  etapa: string,
  sucesso: boolean,
  detalhe: Record<string, unknown> = {},
) {
  const prefix = `[google-calendar-callback][${etapa}]`;
  if (sucesso) console.log(prefix, JSON.stringify(detalhe));
  else console.error(prefix, JSON.stringify(detalhe));
  try {
    await admin.from('google_oauth_debug').insert({
      user_id: userId,
      etapa,
      sucesso,
      detalhe,
    });
  } catch (e) {
    console.error(`${prefix} falha ao gravar diagnóstico:`, e);
  }
}

serve(async (req) => {
  const defaultRedirect = 'https://app.lunarihub.com/app/integracoes?tab=calendar';
  let redirectUri = defaultRedirect;
  let userId: string | null = null;

  try {
    const url = new URL(req.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const oauthError = url.searchParams.get('error');

    await logStep(null, 'callback_recebido', true, {
      has_code: !!code,
      has_state: !!state,
      oauth_error: oauthError,
      method: req.method,
    });

    // ---- 1. Decodificar state ----
    let stateData: { userId?: string; redirectUri?: string } | null = null;
    if (state) {
      try {
        const base64 = state.replace(/-/g, '+').replace(/_/g, '/');
        stateData = JSON.parse(atob(base64));
        userId = stateData?.userId ?? null;
        await logStep(userId, 'state_decodificado', true, {
          has_user_id: !!userId,
          redirect_uri: stateData?.redirectUri ?? null,
        });
      } catch (e) {
        await logStep(null, 'state_decodificado', false, {
          erro: String(e),
          state_len: state.length,
        });
      }
    }

    if (stateData?.redirectUri) redirectUri = stateData.redirectUri;
    if (redirectUri.includes('lunarihub.com') && !redirectUri.includes('app.lunarihub.com')) {
      redirectUri = redirectUri.replace('lunarihub.com', 'app.lunarihub.com');
    }

    if (oauthError) {
      await logStep(userId, 'oauth_recusado', false, { oauth_error: oauthError });
      return Response.redirect(withParams(redirectUri, { google_error: oauthError }), 302);
    }

    if (!code || !userId) {
      await logStep(userId, 'parametros_ausentes', false, { has_code: !!code, has_user_id: !!userId });
      return Response.redirect(withParams(redirectUri, { google_error: 'missing_params' }), 302);
    }

    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
      await logStep(userId, 'credenciais_ausentes', false, {
        has_client_id: !!GOOGLE_CLIENT_ID,
        has_client_secret: !!GOOGLE_CLIENT_SECRET,
      });
      return Response.redirect(withParams(redirectUri, { google_error: 'missing_credentials' }), 302);
    }

    // ---- 2. Trocar code por tokens ----
    const callbackUrl = 'https://app.lunarihub.com/auth/google/callback';
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: callbackUrl,
        grant_type: 'authorization_code',
      }),
    });

    const rawToken = await tokenResponse.text();
    let tokenData: Record<string, any> = {};
    try {
      tokenData = JSON.parse(rawToken);
    } catch {
      tokenData = {};
    }

    await logStep(userId, 'token_exchange', tokenResponse.ok && !tokenData.error, {
      http_status: tokenResponse.status,
      error: tokenData.error ?? null,
      error_description: tokenData.error_description ?? null,
      has_access_token: !!tokenData.access_token,
      has_refresh_token: !!tokenData.refresh_token,
      scope: tokenData.scope ?? null,
      expires_in: tokenData.expires_in ?? null,
      redirect_uri_enviado: callbackUrl,
      corpo_bruto: tokenData.access_token ? undefined : rawToken.slice(0, 500),
    });

    if (!tokenResponse.ok || tokenData.error || !tokenData.access_token) {
      return Response.redirect(
        withParams(redirectUri, {
          google_error: 'token_exchange_failed',
          detail: String(tokenData.error || tokenResponse.status),
        }),
        302,
      );
    }

    // ---- 3. Criar calendário dedicado (não bloqueante) ----
    let calendarId = 'primary';
    try {
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
      if (calendarResponse.ok) {
        const calendarData = await calendarResponse.json();
        calendarId = calendarData.id;
        await logStep(userId, 'calendario_criado', true, { calendar_id: calendarId });
      } else {
        const body = await calendarResponse.text();
        await logStep(userId, 'calendario_criado', false, {
          http_status: calendarResponse.status,
          corpo: body.slice(0, 500),
          fallback: 'primary',
        });
      }
    } catch (e) {
      await logStep(userId, 'calendario_criado', false, { erro: String(e), fallback: 'primary' });
    }

    // ---- 4. Gravar integração ----
    const expiresIn = Number(tokenData.expires_in) || 3600;
    const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

    const { data: existing, error: fetchError } = await admin
      .from('usuarios_integracoes')
      .select('id, refresh_token, dados_extras')
      .eq('user_id', userId)
      .eq('provedor', 'google_calendar')
      .maybeSingle();

    if (fetchError) {
      await logStep(userId, 'busca_integracao', false, {
        message: fetchError.message,
        code: (fetchError as any).code ?? null,
        details: (fetchError as any).details ?? null,
      });
    }

    const refreshToken = tokenData.refresh_token || existing?.refresh_token || null;

    const integrationPayload = {
      user_id: userId,
      provedor: 'google_calendar',
      access_token: tokenData.access_token,
      refresh_token: refreshToken,
      expira_em: expiresAt,
      conectado_em: new Date().toISOString(),
      status: refreshToken ? 'ativo' : 'pendente',
      dados_extras: {
        ...((existing?.dados_extras as Record<string, unknown>) || {}),
        calendar_id: calendarId,
        sync_enabled: true,
        error: null,
        error_at: null,
      },
    };

    const { error: writeError } = existing
      ? await admin.from('usuarios_integracoes').update(integrationPayload).eq('id', existing.id)
      : await admin.from('usuarios_integracoes').insert(integrationPayload);

    if (writeError) {
      await logStep(userId, 'gravacao_integracao', false, {
        operacao: existing ? 'update' : 'insert',
        message: writeError.message,
        code: (writeError as any).code ?? null,
        details: (writeError as any).details ?? null,
        hint: (writeError as any).hint ?? null,
      });
      return Response.redirect(
        withParams(redirectUri, {
          google_error: 'database_error',
          detail: String((writeError as any).code || writeError.message).slice(0, 80),
        }),
        302,
      );
    }

    await logStep(userId, 'gravacao_integracao', true, {
      operacao: existing ? 'update' : 'insert',
      status: integrationPayload.status,
      calendar_id: calendarId,
    });

    const finalUrl = withParams(redirectUri, { google_success: 'true' });
    await logStep(userId, 'redirect_final', true, { url: finalUrl });
    return Response.redirect(finalUrl, 302);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await logStep(userId, 'excecao_nao_tratada', false, {
      message,
      stack: error instanceof Error ? String(error.stack).slice(0, 800) : null,
    });
    return Response.redirect(
      withParams(redirectUri, { google_error: 'unknown', detail: message.slice(0, 120) }),
      302,
    );
  }
});
