import { capabilityToAITool, listCapabilities, type AICapabilityTool } from "@/shared/capability";
import type { AuthUser } from "@/shared/ports";
import {
  AI_MEMORY_ALLOWED,
  canUserRun,
  needsHumanApproval,
  listMemoryAICapabilityIds,
  REQUIRES_APPROVAL,
} from "./permissions";

export interface MemoryAITool extends AICapabilityTool {
  needsApproval: boolean;
  permissions: string[];
}

export function listMemoryAITools(opts?: {
  user?: AuthUser | null;
  kind?: "command" | "query";
}): MemoryAITool[] {
  const caps = listCapabilities({ module: "memory", kind: opts?.kind }).filter((c) =>
    AI_MEMORY_ALLOWED.has(c.id),
  );
  const filtered =
    opts?.user === undefined ? caps : caps.filter((c) => canUserRun(opts.user!, c.id));
  return filtered.map((c) => ({
    ...capabilityToAITool(c),
    needsApproval: needsHumanApproval(c.id),
    permissions: c.permissions,
  }));
}

export { REQUIRES_APPROVAL, listMemoryAICapabilityIds };
