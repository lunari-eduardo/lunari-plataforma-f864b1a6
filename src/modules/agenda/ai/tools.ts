/**
 * Catálogo de tools de IA do módulo Agenda.
 *
 * Deriva do `capabilityRegistry` global (garantido pelo side-effect de
 * `import "@/modules/agenda"` no `ai-registry`) e enriquece com metadados
 * de aprovação humana.
 */

import {
  capabilityToAITool,
  listCapabilities,
  type AICapabilityTool,
} from "@/shared/capability";
import type { AuthUser } from "@/shared/ports";
import {
  AI_AGENDA_ALLOWED,
  canUserRun,
  needsHumanApproval,
  listAgendaAICapabilityIds,
  REQUIRES_APPROVAL,
} from "./permissions";

export interface AgendaAITool extends AICapabilityTool {
  needsApproval: boolean;
  permissions: string[];
}

export function listAgendaAITools(opts?: {
  user?: AuthUser | null;
  kind?: "command" | "query";
}): AgendaAITool[] {
  const caps = listCapabilities({ module: "agenda", kind: opts?.kind }).filter((c) =>
    AI_AGENDA_ALLOWED.has(c.id),
  );
  const filtered =
    opts?.user === undefined ? caps : caps.filter((c) => canUserRun(opts.user!, c.id));
  return filtered.map((c) => ({
    ...capabilityToAITool(c),
    needsApproval: needsHumanApproval(c.id),
    permissions: c.permissions,
  }));
}

export function agendaAIToolMap(opts?: Parameters<typeof listAgendaAITools>[0]) {
  const map = new Map<string, AgendaAITool>();
  for (const t of listAgendaAITools(opts)) map.set(t.id, t);
  return map;
}

export { REQUIRES_APPROVAL, listAgendaAICapabilityIds };
