/**
 * Catálogo de tools de IA expostas pelo módulo Tasks.
 *
 * Onda 6 — superfície de IA. ÚNICA porta pela qual um agente (Lu, autopilot,
 * MCP) deve enxergar capabilities de Tasks. O catálogo é derivado do
 * `capabilityRegistry` global e enriquecido com metadados de aprovação
 * humana (`needsApproval`) vindos de `permissions.ts`.
 */

import { capabilityToAITool, getCapability, listCapabilities, type AICapabilityTool } from "@/shared/capability";
import {
  REQUIRES_APPROVAL,
  canUserRun,
  needsHumanApproval,
  listTasksCapabilityIds,
} from "./permissions";
import { supabaseTasksRepo } from "../infrastructure/supabase/tasksRepo";
import { MIRROR_ROOT_TAG } from "@/features/workflow/domain/productTaskMirror";
import { isOk } from "@/shared/result";
import type { AuthUser } from "@/shared/ports";

export interface TasksAITool extends AICapabilityTool {
  needsApproval: boolean;
  permissions: string[];
}

/**
 * Commands que operam sobre uma tarefa específica: o wrapper valida se ela
 * é tarefa-espelho (tag workflow:produto) e bloqueia com BLOCKED_MIRROR_TASK.
 */
const SINGLE_TASK_COMMANDS = new Set([
  "tasks.update",
  "tasks.complete",
  "tasks.reopen",
  "tasks.delete",
  "tasks.snooze",
  "tasks.move",
  "tasks.assign",
]);

/**
 * Queries cujo output contém `tasks: unknown[]` ou buckets — pós-filtramos
 * tarefas-espelho antes de devolver à IA.
 */
const TASK_LIST_QUERIES = new Set([
  "tasks.list",
  "tasks.search",
  "tasks.dueOverview",
]);

function isMirrorTag(tags: unknown): boolean {
  return Array.isArray(tags) && (tags as string[]).includes(MIRROR_ROOT_TAG);
}

function stripMirror<T>(value: T): T {
  if (!value || typeof value !== "object") return value;
  const v = value as any;
  if (Array.isArray(v.tasks)) v.tasks = v.tasks.filter((t: any) => !isMirrorTag(t?.tags));
  if (v.buckets && typeof v.buckets === "object") {
    for (const k of Object.keys(v.buckets)) {
      const arr = v.buckets[k];
      if (Array.isArray(arr)) v.buckets[k] = arr.filter((t: any) => !isMirrorTag(t?.tags));
    }
  }
  return v;
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

/**
 * Envolve `execute` de uma capability de Tasks para a superfície de IA:
 *  - Pós-filtra tarefas-espelho de queries de listagem.
 *  - Bloqueia commands de single-task quando alvo é tarefa-espelho.
 *
 * Usado pelo Edge Function do assistente — o `execute` "cru" da capability
 * permanece inalterado para chamadas de UI (usuário humano).
 */
export async function invokeTaskCapabilityForAI(
  capabilityId: string,
  rawInput: unknown,
  overrides?: { user?: AuthUser | null; runtime?: "client" | "server" },
) {
  const cap = getCapability(capabilityId);
  if (!cap) return { ok: false as const, error: { code: "NOT_FOUND", message: "Capability desconhecida." } };

  if (SINGLE_TASK_COMMANDS.has(capabilityId)) {
    const id = (rawInput as any)?.id;
    if (typeof id === "string" && overrides?.user?.id) {
      const t = await supabaseTasksRepo.getById(id, overrides.user.id).catch(() => null);
      if (t && isMirrorTag(t.tags)) {
        return {
          ok: false as const,
          error: {
            code: "BLOCKED_MIRROR_TASK",
            message:
              "Esta tarefa é espelho automático de um produto do Workflow. Use workflow.produto.advanceStage/retreatStage/etc para alterar.",
          },
        };
      }
    }
  }

  const result = await cap.execute(rawInput, overrides);
  if (isOk(result) && TASK_LIST_QUERIES.has(capabilityId)) {
    return { ok: true as const, value: stripMirror(result.value) };
  }
  return result;
}

/** Mapa rápido id → tool para o agente resolver tool_calls. */
export function tasksAIToolMap(opts?: Parameters<typeof listTasksAITools>[0]) {
  const map = new Map<string, TasksAITool>();
  for (const t of listTasksAITools(opts)) map.set(t.id, t);
  return map;
}

export { REQUIRES_APPROVAL, listTasksCapabilityIds };
