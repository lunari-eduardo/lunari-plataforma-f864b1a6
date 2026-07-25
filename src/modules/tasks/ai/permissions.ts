/**
 * Permissões da superfície de IA do módulo Tasks.
 *
 * Onda 6 — superfície tipada para o Assistente Lu.
 *
 * Filosofia (Constituição Lunari v1.0): a IA executa apenas o que o usuário
 * já poderia executar manualmente. O gate efetivo (RLS + ownership) acontece
 * dentro de cada capability; este módulo é o contrato declarativo consumido
 * pelo adaptador de tools.
 */

import type { AuthUser } from "@/shared/ports";
import { getCapability, listCapabilities } from "@/shared/capability";
import {
  registerModuleApprovals,
  needsHumanApproval as centralNeedsApproval,
} from "@/shared/ai/approvalRegistry";

export const TASKS_PERMISSIONS = [
  "tasks:read",
  "tasks:write",
  "tasks:delete",
  "tasks:bulk",
] as const;

export type TasksPermission = (typeof TASKS_PERMISSIONS)[number];

export const REQUIRES_APPROVAL: ReadonlySet<string> = new Set([
  "tasks.delete",
  "tasks.attachment.remove",
  "tasks.tags.delete",
  "tasks.people.delete",
]);

registerModuleApprovals({ module: "tasks", requireApproval: REQUIRES_APPROVAL });

export function listTasksCapabilityIds(): string[] {
  return listCapabilities({ module: "tasks" }).map((c) => c.id);
}

export function canUserRun(user: AuthUser | null, capabilityId: string): boolean {
  if (!user) return false;
  const cap = getCapability(capabilityId);
  if (!cap) return false;
  if (!cap.id.startsWith("tasks.")) return false;
  return true;
}

export function needsHumanApproval(capabilityId: string): boolean {
  return centralNeedsApproval(capabilityId) || REQUIRES_APPROVAL.has(capabilityId);
}
