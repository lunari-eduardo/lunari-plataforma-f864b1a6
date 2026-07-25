import {
  capabilityToAITool,
  listCapabilities,
  type AICapabilityTool,
} from "@/shared/capability";
import type { AuthUser } from "@/shared/ports";
import {
  canUserRun,
  needsHumanApproval,
  listConfiguracoesCapabilityIds,
  REQUIRES_APPROVAL,
} from "./permissions";

export interface ConfiguracoesAITool extends AICapabilityTool {
  needsApproval: boolean;
  permissions: string[];
}

export function listConfiguracoesAITools(opts?: {
  user?: AuthUser | null;
  kind?: "command" | "query";
}): ConfiguracoesAITool[] {
  const caps = listCapabilities({ module: "configuracoes", kind: opts?.kind });
  const filtered =
    opts?.user === undefined ? caps : caps.filter((c) => canUserRun(opts.user!, c.id));
  return filtered.map((c) => ({
    ...capabilityToAITool(c),
    needsApproval: needsHumanApproval(c.id),
    permissions: c.permissions,
  }));
}

export { REQUIRES_APPROVAL, listConfiguracoesCapabilityIds };
