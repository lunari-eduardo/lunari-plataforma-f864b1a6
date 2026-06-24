/**
 * Helper: executa queries Supabase com filtro `.in(column, ids)` em lotes,
 * evitando estourar o limite de URI do PostgREST (~8 KB) quando o conjunto
 * de IDs é grande (workflow ≥ 300 sessões já estoura).
 *
 * Uso:
 *   const rows = await chunkedIn(ids, 100, async (chunk) => {
 *     const { data, error } = await supabase
 *       .from("clientes_transacoes")
 *       .select("*")
 *       .eq("user_id", userId)
 *       .in("session_id", chunk)
 *       .in("tipo", ["pagamento", "ajuste"]);
 *     if (error) throw error;
 *     return data ?? [];
 *   });
 */

export const DEFAULT_IN_CHUNK_SIZE = 100;
export const HARD_CAP = 5000;

export async function chunkedIn<T>(
  ids: readonly string[],
  chunkSize: number,
  runner: (chunk: string[]) => Promise<T[]>,
): Promise<T[]> {
  if (!ids || ids.length === 0) return [];

  let workingIds = ids as string[];
  if (workingIds.length > HARD_CAP) {
    console.warn(
      `[chunkedIn] received ${workingIds.length} ids (> ${HARD_CAP}). Truncating — likely a bug upstream.`,
    );
    workingIds = workingIds.slice(0, HARD_CAP);
  }

  const size = Math.max(1, chunkSize || DEFAULT_IN_CHUNK_SIZE);
  const chunks: string[][] = [];
  for (let i = 0; i < workingIds.length; i += size) {
    chunks.push(workingIds.slice(i, i + size));
  }

  const results = await Promise.all(chunks.map((c) => runner(c)));
  return results.flat();
}
