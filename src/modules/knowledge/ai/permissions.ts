import type { AuthUser } from "@/shared/ports";

/**
 * Permissões AI do Knowledge Engine.
 * v1: leitura e escrita liberadas para qualquer usuário autenticado
 * (RLS garante isolamento owner-scoped). Aprovação não é exigida:
 * embed é idempotente e search é read-only.
 */
export const AI_KNOWLEDGE_ALLOWED = new Set<string>([
  "knowledge.search",
  "knowledge.embed",
]);

export const REQUIRES_APPROVAL = new Set<string>([]);

export function canUserRun(_user: AuthUser | null, capabilityId: string): boolean {
  return AI_KNOWLEDGE_ALLOWED.has(capabilityId);
}

export function needsHumanApproval(capabilityId: string): boolean {
  return REQUIRES_APPROVAL.has(capabilityId);
}

export function listKnowledgeAICapabilityIds(): string[] {
  return Array.from(AI_KNOWLEDGE_ALLOWED);
}
