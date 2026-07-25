import type { AuthUser } from "@/shared/ports";
import { getCapability, listCapabilities } from "@/shared/capability";
import {
  registerModuleApprovals,
  needsHumanApproval as centralNeedsApproval,
} from "@/shared/ai/approvalRegistry";

/**
 * Permissions do módulo Formulários para o Assistente Lu (Onda D.1).
 * Limite v1 da Lu: não publica formulários sem aprovação humana explícita.
 */
export const REQUIRES_APPROVAL: ReadonlySet<string> = new Set([
  "formularios.publishForm",
  "formularios.unpublishForm",
  "formularios.deleteForm",
  "formularios.deleteResponse",
  "formularios.reopenSubmission",
  "formularios.generateAIBriefing",
  "formularios.generateFormWithAI",
]);

registerModuleApprovals({ module: "formularios", requireApproval: REQUIRES_APPROVAL });

export function listFormulariosCapabilityIds(): string[] {
  return listCapabilities({ module: "formularios" }).map((c) => c.id);
}

export function canUserRun(user: AuthUser | null, capabilityId: string): boolean {
  if (!user) return false;
  const cap = getCapability(capabilityId);
  if (!cap) return false;
  return cap.id.startsWith("formularios.");
}

export function needsHumanApproval(capabilityId: string): boolean {
  return centralNeedsApproval(capabilityId) || REQUIRES_APPROVAL.has(capabilityId);
}
