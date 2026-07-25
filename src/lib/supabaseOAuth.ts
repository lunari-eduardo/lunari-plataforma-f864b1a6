/**
 * Wrapper tipado para o namespace beta `supabase.auth.oauth`.
 * Serve o fluxo de consentimento OAuth 2.1 (Site URL + Authorization Path
 * configurados no Supabase → https://app.lunarihub.com/oauth/consent).
 *
 * As chamadas passam pelo cliente Supabase existente; este arquivo apenas dá
 * tipos estáveis enquanto o SDK marca a superfície como beta.
 */
import { supabase } from "@/integrations/supabase/client";

export interface OAuthClientInfo {
  id?: string;
  client_id?: string;
  name?: string;
  client_name?: string;
  logo_uri?: string;
  client_uri?: string;
}

export interface OAuthAuthorizationDetails {
  id?: string;
  client?: OAuthClientInfo;
  scope?: string;
  scopes?: string[];
  redirect_url?: string;
  redirect_to?: string;
  expires_at?: string | null;
}

export interface OAuthRedirectResult {
  redirect_url?: string;
  redirect_to?: string;
}

// O SDK ainda expõe `oauth` como beta — usamos any pra evitar quebra de tipos.
function oauthNs(): any {
  const auth = (supabase as any).auth;
  if (!auth?.oauth) {
    throw new Error(
      "supabase.auth.oauth indisponível — verifique se o OAuth Server está habilitado no projeto."
    );
  }
  return auth.oauth;
}

export async function getAuthorizationDetails(
  authorizationId: string
): Promise<{ data: OAuthAuthorizationDetails | null; error: Error | null }> {
  try {
    const { data, error } = await oauthNs().getAuthorizationDetails(authorizationId);
    return { data: (data ?? null) as OAuthAuthorizationDetails | null, error: error ?? null };
  } catch (e) {
    return { data: null, error: e as Error };
  }
}

export async function approveAuthorization(
  authorizationId: string
): Promise<{ data: OAuthRedirectResult | null; error: Error | null }> {
  try {
    const { data, error } = await oauthNs().approveAuthorization(authorizationId);
    return { data: (data ?? null) as OAuthRedirectResult | null, error: error ?? null };
  } catch (e) {
    return { data: null, error: e as Error };
  }
}

export async function denyAuthorization(
  authorizationId: string
): Promise<{ data: OAuthRedirectResult | null; error: Error | null }> {
  try {
    const { data, error } = await oauthNs().denyAuthorization(authorizationId);
    return { data: (data ?? null) as OAuthRedirectResult | null, error: error ?? null };
  } catch (e) {
    return { data: null, error: e as Error };
  }
}

/**
 * Valida um path relativo pra ser reaproveitado como `?next=`.
 * Bloqueia URLs absolutas (previne open-redirect via redirect_uri manipulado).
 */
export function sanitizeNextPath(next: string | null | undefined, fallback = "/app"): string {
  if (!next) return fallback;
  if (!next.startsWith("/") || next.startsWith("//")) return fallback;
  // Bloqueia esquemas embutidos (ex.: "/\thttps://evil")
  if (/[\r\n\t]/.test(next)) return fallback;
  return next;
}
