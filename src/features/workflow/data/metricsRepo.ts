import { supabase } from "@/integrations/supabase/client";
import { metricsCache, type CachedMetrics } from "./metricsCache";

/**
 * Busca métricas do mês via RPC `workflow_month_metrics` e semeia o cache SWR.
 * - Dedup: se já houver uma Promise em voo para (userId, y, m), reaproveita.
 * - Não formata; retorna números crus.
 */

const inflight = new Map<string, Promise<CachedMetrics | null>>();
const lastFetchAt = new Map<string, number>();
// SWR longo (Tranche 3): confiamos em invalidação por evento em vez de TTL curto.
const FRESH_TTL_MS = 24 * 60 * 60 * 1000;

const rangeOf = (y: number, m: number) => {
  const start = `${y}-${String(m).padStart(2, "0")}-01`;
  const lastDay = new Date(y, m, 0).getDate();
  const end = `${y}-${String(m).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  return { start, end };
};

export function invalidateMonthMetricsTTL(userId: string, year: number, month: number) {
  lastFetchAt.delete(`${userId}:${year}-${month}`);
}

export async function fetchMonthMetrics(
  userId: string,
  year: number,
  month: number,
  opts?: { force?: boolean; signal?: AbortSignal },
): Promise<CachedMetrics | null> {
  const key = `${userId}:${year}-${month}`;
  const pending = inflight.get(key);
  if (pending) return pending;

  // TTL: se a última resposta é recente e não veio `force`, devolve o cache.
  if (!opts?.force) {
    const last = lastFetchAt.get(key) ?? 0;
    if (Date.now() - last < FRESH_TTL_MS) {
      const cached = metricsCache.getSync(userId, year, month);
      if (cached) return cached;
    }
  }

  const promise = (async () => {
    const { start, end } = rangeOf(year, month);
    let q: any = supabase.rpc("workflow_month_metrics", {
      p_user_id: userId,
      p_start: start,
      p_end: end,
    });
    if (opts?.signal) q = q.abortSignal(opts.signal);
    const { data, error } = await q;
    if (error) throw error;
    const row: any = Array.isArray(data) ? data[0] : data;
    if (!row) return null;
    const parsed: CachedMetrics = {
      previsto: Number(row.previsto) || 0,
      receita: Number(row.receita) || 0,
      aReceber: Number(row.pendente) || 0,
      sessoes: Number(row.sessoes) || 0,
      creditosGerados: Number(row.creditos_gerados) || 0,
      creditosUtilizados: Number(row.creditos_utilizados) || 0,
      caixaRecebido: Number(row.caixa_recebido) || 0,
    };
    metricsCache.set(userId, year, month, parsed);
    lastFetchAt.set(key, Date.now());
    return parsed;
  })().finally(() => {
    inflight.delete(key);
  });

  inflight.set(key, promise);
  return promise;
}


/** Prefetch fire-and-forget: só chama RPC se não houver cache válido. */
export async function prefetchMonthMetrics(userId: string, year: number, month: number) {
  if (metricsCache.getSync(userId, year, month)) return;
  try {
    await fetchMonthMetrics(userId, year, month);
  } catch {
    /* silencioso */
  }
}
