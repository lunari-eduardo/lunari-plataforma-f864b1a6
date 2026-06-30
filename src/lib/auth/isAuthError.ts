/**
 * Detecta se um erro do Supabase/PostgREST é decorrente de problema de
 * autenticação (JWT expirado, refresh falhou, 401/403). Compartilhado por
 * `useAccessControl`, retries do React Query e helpers de auth.
 */
export function isAuthError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const e = error as any;
  const message = String(e.message ?? '').toLowerCase();
  const code = String(e.code ?? '').toLowerCase();
  const status = e.status ?? e.statusCode;

  return (
    message.includes('jwt') ||
    message.includes('token') ||
    message.includes('expired') ||
    message.includes('invalid claim') ||
    message.includes('not authenticated') ||
    message.includes('refresh_token') ||
    message.includes('invalid_grant') ||
    message.includes('session') ||
    code === '401' ||
    code === '403' ||
    code === 'pgrst301' ||
    code === 'pgrst302' ||
    status === 401 ||
    status === 403
  );
}
