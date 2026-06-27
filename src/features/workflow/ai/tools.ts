/**
 * Catálogo de tools de IA expostas pelo módulo Workflow.
 *
 * Onda 6 — superfície de IA. Esta é a ÚNICA porta pela qual um agente
 * (chat assistant, autopilot, MCP) deve enxergar capabilities do
 * Workflow. O catálogo é derivado do `capabilityRegistry` global e
 * enriquecido com metadados de aprovação humana (`needsApproval`)
 * vindos de `permissions.ts`.
 *
 * Como o adaptador para o AI SDK (formato `tool({...})`) depende do
 * runtime, expomos os descritores serializáveis (`AICapabilityTool`) e
 * deixamos cada surface plugar seu adaptador.
 */

import { capabilityToAITool, listCapabilities, type AICapabilityTool } from "@/shared/capability";
import {
  REQUIRES_APPROVAL,
  canUserRun,
  needsHumanApproval,
  listWorkflowCapabilityIds,
} from "./permissions";
import type { AuthUser } from "@/shared/ports";

export interface WorkflowAITool extends AICapabilityTool {
  /** Marcação para o agente: a IA não pode executar sem confirmação humana. */
  needsApproval: boolean;
  /** Conjunto de permissões declarado pela capability. */
  permissions: string[];
}

/**
 * Devolve a lista de tools de Workflow expostas à IA.
 * - Sem filtro: lista todas (queries + commands).
 * - Com `user`: filtra para as que o usuário pode executar.
 * - Com `kind`: filtra por commands ou queries.
 */
export function listWorkflowAITools(opts?: {
  user?: AuthUser | null;
  kind?: "command" | "query";
}): WorkflowAITool[] {
  const caps = listCapabilities({ module: "workflow", kind: opts?.kind });
  const filtered = opts?.user === undefined
    ? caps
    : caps.filter((c) => canUserRun(opts.user!, c.id));

  return filtered.map((c) => ({
    ...capabilityToAITool(c),
    needsApproval: needsHumanApproval(c.id),
    permissions: c.permissions,
  }));
}

/** Mapa rápido id → tool para o agente resolver tool_calls. */
export function workflowAIToolMap(opts?: Parameters<typeof listWorkflowAITools>[0]) {
  const map = new Map<string, WorkflowAITool>();
  for (const t of listWorkflowAITools(opts)) map.set(t.id, t);
  return map;
}

export { REQUIRES_APPROVAL, listWorkflowCapabilityIds };
