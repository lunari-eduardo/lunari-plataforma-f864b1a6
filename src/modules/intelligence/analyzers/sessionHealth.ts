import { supabase } from "@/integrations/supabase/client";
import type { IntelligenceUpsert } from "@/shared/intelligence";

/**
 * Analyzer puro-ish: lê sessões ativas e produz sinais `session.health`.
 * Heurística v1 (sem LLM):
 *  - pagamento pendente > 0 → warn.
 *  - data da sessão ≤ 7 dias e pagamento pendente → crit.
 *  - status "cancelado" → info (score 0, encerra sinal).
 */
export async function analyzeSessionHealth(userId: string): Promise<IntelligenceUpsert[]> {
  const { data, error } = await supabase
    .from("clientes_sessoes")
    .select("id, data, status, valor_total, valor_pago, cliente_nome")
    .eq("user_id", userId)
    .limit(500);
  if (error) throw error;

  const signals: IntelligenceUpsert[] = [];
  const now = Date.now();

  for (const s of data ?? []) {
    const total = Number(s.valor_total ?? 0);
    const pago = Number(s.valor_pago ?? 0);
    const pendente = Math.max(0, total - pago);
    const reasons: string[] = [];
    let severity: "info" | "warn" | "crit" = "info";
    let score = 0;

    const dt = s.data ? new Date(s.data as string).getTime() : null;
    const daysUntil = dt ? Math.round((dt - now) / (1000 * 60 * 60 * 24)) : null;

    if (String(s.status ?? "").toLowerCase().includes("cancel")) {
      reasons.push("Sessão cancelada.");
    } else if (pendente > 0) {
      reasons.push(`Pendente R$ ${pendente.toFixed(2)}.`);
      severity = "warn";
      score = 0.5;
      if (daysUntil !== null && daysUntil <= 7 && daysUntil >= 0) {
        reasons.push(`Sessão em ${daysUntil}d.`);
        severity = "crit";
        score = 0.9;
      }
    } else {
      reasons.push("Pagamento em dia.");
    }

    signals.push({
      userId,
      kind: "session.health",
      scopeKey: String(s.id),
      severity,
      score,
      reasons,
      inputsHash: `sh:${s.id}:${total}:${pago}:${s.status}`,
    });
  }

  return signals;
}
