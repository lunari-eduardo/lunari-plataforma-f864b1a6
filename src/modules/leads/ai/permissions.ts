import type { AuthUser } from "@/shared/ports";
import { getCapability, listCapabilities } from "@/shared/capability";
import {
  registerModuleApprovals,
  needsHumanApproval as centralNeedsApproval,
} from "@/shared/ai/approvalRegistry";

/**
 * Permissions do módulo Leads para o Assistente Lu (Bloco B1).
 *
 * Gate humano para ações com efeito colateral fora do funil ou difíceis de
 * reverter: conversão em cliente (cria cadastro) e exclusão definitiva.
 * Mover estágio, arquivar e marcar perda são reversíveis e não exigem
 * aprovação — o histórico do lead preserva o rastro. Exclusão definitiva
 * não existe no v1: o funil usa arquivamento.
 */
export const REQUIRES_APPROVAL: ReadonlySet<string> = new Set([
  "leads.convertToCliente",
]);

registerModuleApprovals({
  module: "leads",
  requireApproval: REQUIRES_APPROVAL,
});

export function listLeadsCapabilityIds(): string[] {
  return listCapabilities({ module: "leads" }).map((c) => c.id);
}

export function canUserRun(user: AuthUser | null, capabilityId: string): boolean {
  if (!user) return false;
  const cap = getCapability(capabilityId);
  if (!cap) return false;
  return cap.id.startsWith("leads.");
}

export function needsHumanApproval(capabilityId: string): boolean {
  return centralNeedsApproval(capabilityId) || REQUIRES_APPROVAL.has(capabilityId);
}
