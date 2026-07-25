/**
 * Wrapper para o fluxo OAuth 2.1 do Supabase (Authorization Server).
 *
 * Estratégia: tenta o namespace beta `supabase.auth.oauth` (quando disponível
 * no SDK) e cai para chamadas REST diretas em `/auth/v1/oauth/authorizations`
 * caso o SDK ainda não exponha esses métodos. Sempre repassa o access_token
 * da sessão atual para autenticar o usuário.
 */
import { supabase } from "@/integrations/supabase/client";

const SUPABASE_URL = (import.meta as any).env?.VITE_SUPABASE_URL as string;

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

function oauthBetaNs(): any | null {
  const auth = (supabase as any).auth;
  const ns = auth?.oauth;
  if (!ns || typeof ns !== "object") return null;
  return ns;
}

async function accessToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

async function restCall<T>(
  path: string,
  init: RequestInit = {}
): Promise<{ data: T | null; error: Error | null }> {
  try {
    if (!SUPABASE_URL) throw new Error("VITE_SUPABASE_URL não configurado.");
    const token = await accessToken();
    if (!token) throw new Error("Sessão ausente. Faça login novamente.");
    const res = await fetch(`${SUPABASE_URL}/auth/v1/oauth/authorizations${path}`, {
      ...init,
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
        apikey: (import.meta as any).env?.VITE_SUPABASE_PUBLISHABLE_KEY ?? "",
        ...(init.headers ?? {}),
      },
    });
    const text = await res.text();
    let body: any = null;
    try { body = text ? JSON.parse(text) : null; } catch { body = { raw: text }; }
    if (!res.ok) {
      const msg =
        body?.error_description ||
        body?.msg ||
        body?.message ||
        body?.error ||
        `HTTP ${res.status}`;
      return { data: null, error: new Error(String(msg)) };
    }
    return { data: body as T, error: null };
  } catch (e) {
    return { data: null, error: e as Error };
  }
}

export async function getAuthorizationDetails(
  authorizationId: string
): Promise<{ data: OAuthAuthorizationDetails | null; error: Error | null }> {
  const ns = oauthBetaNs();
  if (ns && typeof ns.getAuthorizationDetails === "function") {
    try {
      const { data, error } = await ns.getAuthorizationDetails(authorizationId);
      if (error) return { data: null, error: error as Error };
      return { data: (data ?? null) as OAuthAuthorizationDetails | null, error: null };
    } catch (e) {
      // Cai pro REST — o SDK beta pode ter mudado a assinatura.
      console.warn("[oauth] beta.getAuthorizationDetails falhou, usando REST:", e);
    }
  }
  return restCall<OAuthAuthorizationDetails>(`/${encodeURIComponent(authorizationId)}`, {
    method: "GET",
  });
}

export async function approveAuthorization(
  authorizationId: string
): Promise<{ data: OAuthRedirectResult | null; error: Error | null }> {
  const ns = oauthBetaNs();
  if (ns && typeof ns.approveAuthorization === "function") {
    try {
      const { data, error } = await ns.approveAuthorization(authorizationId);
      if (error) return { data: null, error: error as Error };
      return { data: (data ?? null) as OAuthRedirectResult | null, error: null };
    } catch (e) {
      console.warn("[oauth] beta.approveAuthorization falhou, usando REST:", e);
    }
  }
  return restCall<OAuthRedirectResult>(`/${encodeURIComponent(authorizationId)}/approve`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export async function denyAuthorization(
  authorizationId: string
): Promise<{ data: OAuthRedirectResult | null; error: Error | null }> {
  const ns = oauthBetaNs();
  if (ns && typeof ns.denyAuthorization === "function") {
    try {
      const { data, error } = await ns.denyAuthorization(authorizationId);
      if (error) return { data: null, error: error as Error };
      return { data: (data ?? null) as OAuthRedirectResult | null, error: null };
    } catch (e) {
      console.warn("[oauth] beta.denyAuthorization falhou, usando REST:", e);
    }
  }
  return restCall<OAuthRedirectResult>(`/${encodeURIComponent(authorizationId)}/deny`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export function sanitizeNextPath(next: string | null | undefined, fallback = "/app"): string {
  if (!next) return fallback;
  if (!next.startsWith("/") || next.startsWith("//")) return fallback;
  if (/[\r\n\t]/.test(next)) return fallback;
  return next;
}
