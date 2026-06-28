/**
 * Catálogo de tools de IA expostas pelo módulo Tasks.
 *
 * Onda 6 — superfície de IA. ÚNICA porta pela qual um agente (Lu, autopilot,
 * MCP) deve enxergar capabilities de Tasks. O catálogo é derivado do
 * `capabilityRegistry` global e enriquecido com metadados de aprovação
 * humana (`needsApproval`) vindos de `permissions.ts`.
 */

import { capabilityToAITool, listCapabilities, type AICapabilityTool } from "@/shared/capability";
import {
  REQUIRES_APPROVAL,
  canUserRun,
  needsHumanApproval,
  listTasksCapabilityIds,
} from "./permissions";
import type { AuthUser } from "@/shared/ports";

export interface TasksAITool extends AICapabilityTool {
  needsApproval: boolean;
  permissions: string[];
}

/**
 * Lista de tools de Tasks expostas à IA.
 * - Sem filtro: lista todas (queries + commands).
 * - Com `user`: filtra para as que o usuário pode executar.
 * - Com `kind`: filtra por commands ou queries.
 */
export function listTasksAITools(opts?: {
  user?: AuthUser | null;
  kind?: "command" | "query";
}): TasksAITool[] {
  const caps = listCapabilities({ module: "tasks", kind: opts?.kind });
  const filtered =
    opts?.user === undefined ? caps : caps.filter((c) => canUserRun(opts.user!, c.id));

  return filtered.map((c) => ({
    ...capabilityToAITool(c),
    needsApproval: needsHumanApproval(c.id),
    permissions: c.permissions,
  }));
}

/** Mapa rápido id → tool para o agente resolver tool_calls. */
export function tasksAIToolMap(opts?: Parameters<typeof listTasksAITools>[0]) {
  const map = new Map<string, TasksAITool>();
  for (const t of listTasksAITools(opts)) map.set(t.id, t);
  return map;
}

export { REQUIRES_APPROVAL, listTasksCapabilityIds };
