import type { AuthUser } from "@/shared/ports";

export const AI_DECISION_ALLOWED = new Set<string>([
  "decision.list",
  "decision.propose",
  "decision.dismiss",
  "decision.accept",
]);

/**
 * `accept` exige aprovação humana (usuário confirma antes de marcar aceita).
 * `dismiss` também — evita que a IA silencie propostas sem consentimento.
 * `list`/`propose` são seguros (leitura e recomputação idempotente).
 */
export const REQUIRES_APPROVAL = new Set<string>(["decision.accept", "decision.dismiss"]);

export function canUserRun(_user: AuthUser | null, capabilityId: string): boolean {
  return AI_DECISION_ALLOWED.has(capabilityId);
}

export function needsHumanApproval(capabilityId: string): boolean {
  return REQUIRES_APPROVAL.has(capabilityId);
}

export function listDecisionAICapabilityIds(): string[] {
  return Array.from(AI_DECISION_ALLOWED);
}
