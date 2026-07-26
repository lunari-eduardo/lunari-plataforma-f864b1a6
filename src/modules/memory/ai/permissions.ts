import type { AuthUser } from "@/shared/ports";

export const AI_MEMORY_ALLOWED = new Set<string>([
  "memory.recall",
  "memory.remember",
  "memory.forget",
]);

export const REQUIRES_APPROVAL = new Set<string>([
  // memory.remember: aprovação dinâmica (source=assistant + scope != assistant).
  "memory.forget",
]);

export function canUserRun(_user: AuthUser | null, capabilityId: string): boolean {
  return AI_MEMORY_ALLOWED.has(capabilityId);
}

export function needsHumanApproval(capabilityId: string): boolean {
  return REQUIRES_APPROVAL.has(capabilityId);
}

export function listMemoryAICapabilityIds(): string[] {
  return Array.from(AI_MEMORY_ALLOWED);
}
