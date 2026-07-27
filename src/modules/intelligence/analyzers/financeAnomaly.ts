import { supabase } from "@/integrations/supabase/client";
import type { IntelligenceUpsert } from "@/shared/intelligence";

/**
 * Analyzer `finance.anomaly.month`.
 *
 * Soma `valor` por mês (data_competencia) do mês corrente e compara com
 * a média dos 3 meses anteriores. Desvio absoluto ≥ 40% → anomalia.
 * Escopo: 1 sinal por mês corrente (`scope_key = YYYY-MM`).
 */
export async function analyzeFinanceAnomaly(userId: string): Promise<IntelligenceUpsert[]> {
  const now = new Date();
  const startWindow = new Date(now.getFullYear(), now.getMonth() - 3, 1).toISOString();
  const { data, error } = await supabase
    .from("fin_transactions")
    .select("valor, data_competencia")
    .eq("user_id", userId)
    .gte("data_competencia", startWindow);
  if (error) return [];

  const bucket = new Map<string, number>();
  for (const row of data ?? []) {
    const iso = String(row.data_competencia ?? "");
    if (!iso) continue;
    const ym = iso.slice(0, 7);
    bucket.set(ym, (bucket.get(ym) ?? 0) + Number(row.valor ?? 0));
  }

  const currentYm = now.toISOString().slice(0, 7);
  const past: number[] = [];
  for (let i = 1; i <= 3; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const ym = d.toISOString().slice(0, 7);
    past.push(bucket.get(ym) ?? 0);
  }
  const cur = bucket.get(currentYm) ?? 0;
  const avg = past.reduce((a, b) => a + b, 0) / Math.max(1, past.length);

  const reasons: string[] = [];
  let severity: "info" | "warn" | "crit" = "info";
  let score = 0;

  const dev = avg > 0 ? (cur - avg) / avg : 0;
  if (Math.abs(dev) >= 0.4) {
    reasons.push(
      `Movimento ${dev > 0 ? "acima" : "abaixo"} da média em ${(Math.abs(dev) * 100).toFixed(0)}%.`,
    );
    severity = dev < 0 ? "warn" : "info";
    score = Math.min(1, Math.abs(dev));
  } else {
    reasons.push("Mês dentro da normalidade.");
  }

  return [
    {
      userId,
      kind: "finance.anomaly.month",
      scopeKey: currentYm,
      severity,
      score,
      reasons,
      inputsHash: `fa:${currentYm}:${cur.toFixed(0)}:${avg.toFixed(0)}`,
    },
  ];
}
