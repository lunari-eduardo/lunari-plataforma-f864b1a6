import type { IntelligenceSignal } from "@/shared/intelligence";
import type { DecisionUpsert } from "@/shared/decision";

/**
 * `finance.anomaly.month` → propõe revisão manual (não sugere ação automática).
 * Capability sugerida: `finance.reviewMonth` (nome reservado; pode ser um
 * comando futuro). Por ora serve como placeholder para o Hub mostrar review.
 */
export function proposeFromFinanceAnomaly(userId: string, s: IntelligenceSignal): DecisionUpsert[] {
  return [
    {
      userId,
      capabilityId: "finance.reviewMonth",
      input: { month: s.scope_key },
      rationale: ["Anomalia financeira detectada no mês.", ...s.reasons.slice(0, 3)],
      sourceKind: s.kind,
      sourceScopeKey: s.scope_key,
      severity: s.severity,
      score: s.score,
    },
  ];
}
