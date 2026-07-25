import type { AuthUser } from "@/shared/ports";
import { getCapability, listCapabilities } from "@/shared/capability";

/**
 * Permissions do módulo Clientes para o Assistente Lu.
 *
 * P3 — Paridade AI (foundation). Nenhuma capability registrada ainda:
 * a listagem virá vazia até que ondas posteriores adicionem
 * `clientes.createClient`, `clientes.updateClient`, `clientes.mergeClients`,
 * etc. O contrato de permissões já está pronto para recebê-las.
 */

export const REQUIRES_APPROVAL: ReadonlySet<string> = new Set([
  // Ações irreversíveis / sensíveis (gate humano):
  "clientes.deleteClient",
  "clientes.mergeClients",
  "clientes.adjustCredits",
]);

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
  return REQUIRES_APPROVAL.has(capabilityId);
}
