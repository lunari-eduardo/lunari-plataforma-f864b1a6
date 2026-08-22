// Helpers de acesso ao Supabase via REST (sem SDK — Worker sem dependências).

export interface Env {
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  LOVABLE_API_KEY?: string;
}

/**
 * Valida o token JWT do usuário logado no app.
 * Retorna o user_id, ou null se o token for inválido/expirado.
 */
export async function requireUserId(env: Env, authorization: string | null): Promise<string | null> {
  if (!authorization?.startsWith('Bearer ')) return null;
  const res = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
    headers: {
      Authorization: authorization,
      apikey: env.SUPABASE_ANON_KEY,
    },
  });
  if (!res.ok) return null;
  const user = (await res.json()) as { id?: string };
  return user?.id ?? null;
}

/** SELECT genérico com service role (bypassa RLS — uso interno do Worker). */
export async function restSelect<T>(env: Env, table: string, query: string): Promise<T[]> {
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/${table}?${query}`, {
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      Accept: 'application/json',
    },
  });
  if (!res.ok) {
    console.error(`restSelect ${table} falhou: ${res.status}`);
    return [];
  }
  return (await res.json()) as T[];
}

/** INSERT com service role, sem retorno (best-effort). */
export async function restInsert(env: Env, table: string, row: Record<string, unknown>): Promise<boolean> {
  try {
    const res = await fetch(`${env.SUPABASE_URL}/rest/v1/${table}`, {
      method: 'POST',
      headers: {
        apikey: env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify(row),
    });
    return res.ok;
  } catch (err) {
    console.error('restInsert falhou (não crítico):', err);
    return false;
  }
}
