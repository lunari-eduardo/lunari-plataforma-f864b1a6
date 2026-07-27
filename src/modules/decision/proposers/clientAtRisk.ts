import type { IntelligenceSignal } from "@/shared/intelligence";
import type { DecisionUpsert } from "@/shared/decision";

/**
 * `client.at_risk` → propõe criar tarefa de follow-up.
 * Capability sugerida: `tasks.create`.
 */
export function proposeFromClientAtRisk(userId: string, s: IntelligenceSignal): DecisionUpsert[] {
  return [
    {
      userId,
      capabilityId: "tasks.create",
      input: {
        titulo: "Follow-up com cliente inativo",
        descricao: s.reasons.join(" "),
        clienteId: s.scope_key,
      },
      rationale: [
        "Cliente sem interação há mais de 60 dias com sessão futura.",
        ...s.reasons.slice(0, 3),
      ],
      sourceKind: s.kind,
      sourceScopeKey: s.scope_key,
      severity: s.severity,
      score: s.score,
    },
  ];
}
