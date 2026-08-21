/**
 * Mutex singleton para serializar `supabase.auth.refreshSession()`.
 *
 * Por que existe: durante o boot do app, dezenas de hooks disparam queries em
 * paralelo. Se o JWT está próximo de expirar, cada query falha com 401 e o
 * `supabase-js` tenta auto-refresh — N chamadas paralelas a `/token` com o
 * MESMO `refresh_token`. O Supabase rotaciona o token a cada chamada e
 * revoga as anteriores. Resultado: a maioria das queries volta com 401 sem
 * recuperação e a UI cai em telas de erro / redirect indevido para
 * `/onboarding`.
 *
 * Este helper centraliza: uma única promise de refresh por vez; chamadas
 * concorrentes esperam a mesma promise.
 */
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

const SOON_THRESHOLD_MS = 60 * 1000; // 60s

let inflight: Promise<{ session: Session | null; error: Error | null }> | null = null;

async function runRefresh(attempt = 1): Promise<{ session: Session | null; error: Error | null }> {
  try {
    const { data, error } = await supabase.auth.refreshSession();
    if (error) {
      // isAuthError && (status === 0 || status === 5xx) => network/gateway issue
      const isNetworkIssue = 
        error.message.includes('Failed to fetch') || 
        error.message.includes('Network request failed') ||
        (error as any).status === 0 || 
        (error as any).status >= 500;
      
      if (isNetworkIssue && attempt < 3) {
        console.warn(`[ensureFreshSession] Network falhou no refresh. Tentativa ${attempt}/3. Retrying in 1s...`);
        await new Promise(r => setTimeout(r, 1000 * attempt));
        return runRefresh(attempt + 1);
      }
      return { session: null, error };
    }
    return { session: data.session ?? null, error: null };
  } catch (e) {
    if (attempt < 3) {
      console.warn(`[ensureFreshSession] Catch error no refresh. Tentativa ${attempt}/3. Retrying em 1s...`, e);
      await new Promise(r => setTimeout(r, 1000 * attempt));
      return runRefresh(attempt + 1);
    }
    return { session: null, error: e as Error };
  }
}

/**
 * Garante que há uma sessão válida pronta para ser usada.
 * - Se não há sessão local: retorna `null` (usuário não autenticado).
 * - Se a sessão expira em < 60s ou já expirou: faz UM refresh (singleton).
 * - Caso contrário: devolve a sessão atual sem chamadas extras.
 */
export async function ensureFreshSession(): Promise<{ session: Session | null; error: Error | null }> {
  const { data } = await supabase.auth.getSession();
  const session = data.session;

  if (!session) return { session: null, error: null };

  const expiresAtMs = (session.expires_at ?? 0) * 1000;
  const now = Date.now();

  // Token ainda válido por mais de SOON_THRESHOLD_MS — nada a fazer.
  if (expiresAtMs - now > SOON_THRESHOLD_MS) {
    return { session, error: null };
  }

  // Coalesce: se já existe um refresh em curso, todos esperam o mesmo.
  if (!inflight) {
    inflight = runRefresh().then(result => {
      if (result.error && (
        result.error.message.includes('Failed to fetch') ||
        result.error.message.includes('Network request failed') ||
        (result.error as any).status === 0 ||
        (result.error as any).status >= 500
      )) {
        console.warn('[ensureFreshSession] Mantendo sessao offline apos falha de network.');
        return { session, error: result.error };
      }
      return result;
    }).finally(() => {
      inflight = null;
    });
  }
  return inflight;
}

/**
 * Força um refresh agora (usado por handlers de 401 explícitos).
 * Também coalesce chamadas paralelas.
 */
export async function forceRefreshSession(): Promise<{ session: Session | null; error: Error | null }> {
  if (!inflight) {
    inflight = runRefresh().finally(() => {
      inflight = null;
    });
  }
  return inflight;
}
