import { capabilityToAITool, listCapabilities, type AICapabilityTool } from "@/shared/capability";
import type { AuthUser } from "@/shared/ports";
import {
  AI_FINANCE_ALLOWED,
  canUserRun,
  needsHumanApproval,
  listFinanceAICapabilityIds,
  REQUIRES_APPROVAL,
} from "./permissions";

export interface FinanceAITool extends AICapabilityTool {
  needsApproval: boolean;
  permissions: string[];
}

export function listFinanceAITools(opts?: {
  user?: AuthUser | null;
  kind?: "command" | "query";
}): FinanceAITool[] {
  const caps = listCapabilities({ module: "finance", kind: opts?.kind }).filter((c) =>
    AI_FINANCE_ALLOWED.has(c.id),
  );
  const filtered =
    opts?.user === undefined ? caps : caps.filter((c) => canUserRun(opts.user!, c.id));
  return filtered.map((c) => ({
    ...capabilityToAITool(c),
    needsApproval: needsHumanApproval(c.id),
    permissions: c.permissions,
  }));
}

export { REQUIRES_APPROVAL, listFinanceAICapabilityIds };
