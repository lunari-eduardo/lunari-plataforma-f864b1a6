import type { AuthUser } from "@/shared/ports";

export const AI_LEARNING_ALLOWED = new Set<string>([
  "learning.patterns.list",
  "learning.recompute",
  "learning.patches.list",
  "learning.patches.apply",
  "learning.patches.dismiss",
]);

/**
 * `apply` e `dismiss` exigem aprovação humana — patches mudam Memory/Decision.
 * `list` e `recompute` são seguros (leitura e agregação idempotente).
 */
export const REQUIRES_APPROVAL = new Set<string>([
  "learning.patches.apply",
  "learning.patches.dismiss",
]);

export function canUserRun(_user: AuthUser | null, capabilityId: string): boolean {
  return AI_LEARNING_ALLOWED.has(capabilityId);
}

export function needsHumanApproval(capabilityId: string): boolean {
  return REQUIRES_APPROVAL.has(capabilityId);
}

export function listLearningAICapabilityIds(): string[] {
  return Array.from(AI_LEARNING_ALLOWED);
}
