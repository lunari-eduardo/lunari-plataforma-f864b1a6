import type { AuthUser } from "@/shared/ports";
import { getCapability, listCapabilities } from "@/shared/capability";

/**
 * Filtramos a superfície de IA do Finance para expor apenas o que faz
 * sentido no chat — não o pacote completo de commands/queries do módulo.
 */
export const AI_FINANCE_ALLOWED: ReadonlySet<string> = new Set([
  "finance.credit.get",
  "finance.credit.grant",
  "finance.credit.revoke",
  "finance.credit.apply",
  "finance.credit.listClientsWithCredit",
]);

export const REQUIRES_APPROVAL: ReadonlySet<string> = new Set([
  "finance.credit.grant",
  "finance.credit.revoke",
  "finance.credit.apply",
]);

export function listFinanceAICapabilityIds(): string[] {
  return listCapabilities({ module: "finance" })
    .map((c) => c.id)
    .filter((id) => AI_FINANCE_ALLOWED.has(id));
}

export function canUserRun(user: AuthUser | null, capabilityId: string): boolean {
  if (!user) return false;
  if (!AI_FINANCE_ALLOWED.has(capabilityId)) return false;
  return !!getCapability(capabilityId);
}

export function needsHumanApproval(capabilityId: string): boolean {
  return REQUIRES_APPROVAL.has(capabilityId);
}
