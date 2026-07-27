import type { AuthUser } from "@/shared/ports";

export const AI_INTELLIGENCE_ALLOWED = new Set<string>([
  "intelligence.list",
  "intelligence.refresh",
]);

/**
 * Nenhuma capability de Intelligence exige aprovação humana:
 * `list` é leitura pura; `refresh` é recomputação idempotente e
 * sobrescreve o próprio derivado (não altera fonte).
 */
export const REQUIRES_APPROVAL = new Set<string>([]);

export function canUserRun(_user: AuthUser | null, capabilityId: string): boolean {
  return AI_INTELLIGENCE_ALLOWED.has(capabilityId);
}

export function needsHumanApproval(capabilityId: string): boolean {
  return REQUIRES_APPROVAL.has(capabilityId);
}

export function listIntelligenceAICapabilityIds(): string[] {
  return Array.from(AI_INTELLIGENCE_ALLOWED);
}
