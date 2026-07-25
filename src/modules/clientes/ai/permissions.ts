import type { AuthUser } from "@/shared/ports";
import { getCapability, listCapabilities } from "@/shared/capability";
import {
  registerModuleApprovals,
  needsHumanApproval as centralNeedsApproval,
} from "@/shared/ai/approvalRegistry";

/**
 * Permissions do módulo Clientes para o Assistente Lu (Onda D.1).
 *
 * Gate humano para ações irreversíveis. Capabilities v1 registradas em
 * `application/clientes.ts` (list/get/search/listSessoes/listTransacoes,
 * create/update/addNota). Delete/merge/adjustCredits ficam reservados —
 * quando forem implementados, entram já como REQUIRES_APPROVAL.
 */
export const REQUIRES_APPROVAL: ReadonlySet<string> = new Set([
  "clientes.delete",
  "clientes.mergeClients",
  "clientes.adjustCredits",
]);

registerModuleApprovals({
  module: "clientes",
  requireApproval: REQUIRES_APPROVAL,
});

export function listClientesCapabilityIds(): string[] {
  return listCapabilities({ module: "clientes" }).map((c) => c.id);
}

export function canUserRun(user: AuthUser | null, capabilityId: string): boolean {
  if (!user) return false;
  const cap = getCapability(capabilityId);
  if (!cap) return false;
  return cap.id.startsWith("clientes.");
}

export function needsHumanApproval(capabilityId: string): boolean {
  return centralNeedsApproval(capabilityId) || REQUIRES_APPROVAL.has(capabilityId);
}
