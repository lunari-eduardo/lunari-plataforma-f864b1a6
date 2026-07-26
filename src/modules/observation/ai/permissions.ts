import type { AuthUser } from "@/shared/ports";

/**
 * Permissões AI do Observation Engine.
 * v1: leitura liberada; escrita liberada (RLS garante owner-scope).
 * Aprovação não é exigida (append-only, sem side-effect de negócio).
 */
export const AI_OBSERVATION_ALLOWED = new Set<string>([
  "observation.recent",
  "observation.record",
]);

export const REQUIRES_APPROVAL = new Set<string>([]);

export function canUserRun(_user: AuthUser | null, capabilityId: string): boolean {
  return AI_OBSERVATION_ALLOWED.has(capabilityId);
}

export function needsHumanApproval(capabilityId: string): boolean {
  return REQUIRES_APPROVAL.has(capabilityId);
}

export function listObservationAICapabilityIds(): string[] {
  return Array.from(AI_OBSERVATION_ALLOWED);
}
