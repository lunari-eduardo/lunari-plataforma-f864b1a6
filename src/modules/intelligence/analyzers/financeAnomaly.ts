import { supabase } from "@/integrations/supabase/client";
import type { IntelligenceUpsert } from "@/shared/intelligence";

/**
 * Analyzer `finance.anomaly.month`.
 *
 * Compara total de transações do mês corrente vs média dos 3 meses
 * anteriores. Desvio > 40% (para mais ou menos) emite anomalia.
 * Escopo: 1 sinal por mês (`scope_key = YYYY-MM`).
 */
export async function analyzeFinanceAnomaly(userId: string): Promise<IntelligenceUpsert[]> {
  const now = new Date();
  const startWindow = new Date(now.getFullYear(), now.getMonth() - 3, 1).toISOString();
  const { data, error } = await supabase
    .from("fin_transactions")
    .select("valor, direction, data_efetiva")
    .eq("user_id", userId)
    .gte("data_efetiva", startWindow);
  if (error) return [];

  const bucket = new Map<string, { in: number; out: number }>();
  for (const row of data ?? []) {
    const iso = String(row.data_efetiva ?? "");
    if (!iso) continue;
    const ym = iso.slice(0, 7);
    const cur = bucket.get(ym) ?? { in: 0, out: 0 };
    const v = Number(row.valor ?? 0);
    if (String(row.direction) === "in") cur.in += v;
    else cur.out += v;
    bucket.set(ym, cur);
  }

  const currentYm = now.toISOString().slice(0, 7);
  const past: Array<{ in: number; out: number }> = [];
  for (let i = 1; i <= 3; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const ym = d.toISOString().slice(0, 7);
    past.push(bucket.get(ym) ?? { in: 0, out: 0 });
  }
  const cur = bucket.get(currentYm) ?? { in: 0, out: 0 };
  const avgIn = past.reduce((a, b) => a + b.in, 0) / Math.max(1, past.length);
  const avgOut = past.reduce((a, b) => a + b.out, 0) / Math.max(1, past.length);

  const reasons: string[] = [];
  let severity: "info" | "warn" | "crit" = "info";
  let score = 0;

  const devIn = avgIn > 0 ? (cur.in - avgIn) / avgIn : 0;
  const devOut = avgOut > 0 ? (cur.out - avgOut) / avgOut : 0;

  if (Math.abs(devIn) >= 0.4) {
    reasons.push(
      `Receita ${devIn > 0 ? "acima" : "abaixo"} da média em ${(Math.abs(devIn) * 100).toFixed(0)}%.`,
    );
    severity = devIn < 0 ? "warn" : "info";
    score = Math.min(1, Math.abs(devIn));
  }
  if (Math.abs(devOut) >= 0.4) {
    reasons.push(
      `Despesa ${devOut > 0 ? "acima" : "abaixo"} da média em ${(Math.abs(devOut) * 100).toFixed(0)}%.`,
    );
    if (devOut > 0) severity = "warn";
    score = Math.max(score, Math.min(1, Math.abs(devOut)));
  }
  if (reasons.length === 0) reasons.push("Mês dentro da normalidade.");

  return [
    {
      userId,
      kind: "finance.anomaly.month",
      scopeKey: currentYm,
      severity,
      score,
      reasons,
      inputsHash: `fa:${currentYm}:${cur.in.toFixed(0)}:${cur.out.toFixed(0)}`,
    },
  ];
}
