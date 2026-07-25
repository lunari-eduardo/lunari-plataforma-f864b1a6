import {
  capabilityToAITool,
  listCapabilities,
  type AICapabilityTool,
} from "@/shared/capability";
import type { AuthUser } from "@/shared/ports";
import {
  canUserRun,
  needsHumanApproval,
  listClientesCapabilityIds,
  REQUIRES_APPROVAL,
} from "./permissions";

export interface ClientesAITool extends AICapabilityTool {
  needsApproval: boolean;
  permissions: string[];
}

export function listClientesAITools(opts?: {
  user?: AuthUser | null;
  kind?: "command" | "query";
}): ClientesAITool[] {
  const caps = listCapabilities({ module: "clientes", kind: opts?.kind });
  const filtered =
    opts?.user === undefined ? caps : caps.filter((c) => canUserRun(opts.user!, c.id));
  return filtered.map((c) => ({
    ...capabilityToAITool(c),
    needsApproval: needsHumanApproval(c.id),
    permissions: c.permissions,
  }));
}

export { REQUIRES_APPROVAL, listClientesCapabilityIds };
