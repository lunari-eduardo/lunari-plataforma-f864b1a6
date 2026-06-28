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

export const TASKS_PERMISSIONS = [
  "tasks:read",
  "tasks:write",
  "tasks:delete",
  "tasks:bulk",
] as const;

export type TasksPermission = (typeof TASKS_PERMISSIONS)[number];

/**
 * Capabilities que SEMPRE exigem aprovação humana quando invocadas pela IA.
 * Operações destrutivas, irreversíveis ou em massa.
 */
export const REQUIRES_APPROVAL: ReadonlySet<string> = new Set([
  "tasks.delete",
  "tasks.attachment.remove",
  "tasks.tags.delete",
  "tasks.people.delete",
]);

/** Capabilities expostas à IA neste módulo. */
export function listTasksCapabilityIds(): string[] {
  return listCapabilities({ module: "tasks" }).map((c) => c.id);
}

/**
 * Verifica se o usuário pode executar a capability. Camada declarativa —
 * o handler valida ownership por `user_id` no DB.
 */
export function canUserRun(user: AuthUser | null, capabilityId: string): boolean {
  if (!user) return false;
  const cap = getCapability(capabilityId);
  if (!cap) return false;
  if (!cap.id.startsWith("tasks.")) return false;
  return true;
}

export function needsHumanApproval(capabilityId: string): boolean {
  return REQUIRES_APPROVAL.has(capabilityId);
}
