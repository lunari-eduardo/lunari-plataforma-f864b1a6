import type { AuthUser } from "@/shared/ports";
import { getCapability, listCapabilities } from "@/shared/capability";
import {
  registerModuleApprovals,
  needsHumanApproval as centralNeedsApproval,
} from "@/shared/ai/approvalRegistry";

/**
 * Permissions do módulo Contratos para o Assistente Lu (Onda D.1).
 * Gate humano para exclusão, envio ao cliente e geração com IA.
 */
export const REQUIRES_APPROVAL: ReadonlySet<string> = new Set([
  "contratos.deleteTemplate",
  "contratos.deleteContrato",
  "contratos.markSentContrato",
  "contratos.generateTemplateWithAI",
  "contratos.generateContratoWithAI",
]);

registerModuleApprovals({ module: "contratos", requireApproval: REQUIRES_APPROVAL });

export function listContratosCapabilityIds(): string[] {
  return listCapabilities({ module: "contratos" }).map((c) => c.id);
}

export function canUserRun(user: AuthUser | null, capabilityId: string): boolean {
  if (!user) return false;
  const cap = getCapability(capabilityId);
  if (!cap) return false;
  return cap.id.startsWith("contratos.");
}

export function needsHumanApproval(capabilityId: string): boolean {
  return centralNeedsApproval(capabilityId) || REQUIRES_APPROVAL.has(capabilityId);
}
