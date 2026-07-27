import type { IntelligenceSignal } from "@/shared/intelligence";
import type { DecisionUpsert } from "@/shared/decision";

/**
 * `session.health` (warn/crit) → propõe gerar cobrança para a sessão.
 * Capability sugerida: `billing.chargeCreate` (não executamos — só sugerimos).
 */
export function proposeFromSessionHealth(userId: string, s: IntelligenceSignal): DecisionUpsert[] {
  if (s.severity === "info") return [];
  return [
    {
      userId,
      capabilityId: "billing.chargeCreate",
      input: { sessaoId: s.scope_key, motivo: "pagamento_pendente" },
      rationale: [
        "Sessão com pagamento pendente próxima da data.",
        ...s.reasons.slice(0, 3),
      ],
      sourceKind: s.kind,
      sourceScopeKey: s.scope_key,
      severity: s.severity,
      score: s.score,
    },
  ];
}
