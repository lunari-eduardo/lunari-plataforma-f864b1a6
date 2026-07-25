import type { AuthUser } from "@/shared/ports";
import { getCapability, listCapabilities } from "@/shared/capability";

/**
 * Permissions do módulo Contratos para o Assistente Lu.
 *
 * Ações irreversíveis / que impactam clientes externos exigem aprovação:
 *  - deleteTemplate / deleteContrato: exclusão definitiva.
 *  - markSentContrato: cliente passa a receber o contrato.
 *  - generateTemplateWithAI / generateContratoWithAI: consumo de crédito IA
 *    + conteúdo que será enviado ao cliente final.
 */
export const REQUIRES_APPROVAL: ReadonlySet<string> = new Set([
  "contratos.deleteTemplate",
  "contratos.deleteContrato",
  "contratos.markSentContrato",
  "contratos.generateTemplateWithAI",
  "contratos.generateContratoWithAI",
]);

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
  return REQUIRES_APPROVAL.has(capabilityId);
}
