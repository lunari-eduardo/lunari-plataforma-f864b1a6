import { capabilityToAITool, listCapabilities, type AICapabilityTool } from "@/shared/capability";
import type { AuthUser } from "@/shared/ports";
import {
  AI_AUTOMATION_ALLOWED,
  canUserRun,
  needsHumanApproval,
  listAutomationAICapabilityIds,
  REQUIRES_APPROVAL,
} from "./permissions";

export interface AutomationAITool extends AICapabilityTool {
  needsApproval: boolean;
  permissions: string[];
}

export function listAutomationAITools(opts?: {
  user?: AuthUser | null;
  kind?: "command" | "query";
}): AutomationAITool[] {
  const caps = listCapabilities({ module: "automation", kind: opts?.kind }).filter((c) =>
    AI_AUTOMATION_ALLOWED.has(c.id),
  );
  const filtered =
    opts?.user === undefined ? caps : caps.filter((c) => canUserRun(opts.user!, c.id));
  return filtered.map((c) => ({
    ...capabilityToAITool(c),
    needsApproval: needsHumanApproval(c.id),
    permissions: c.permissions,
  }));
}

export { REQUIRES_APPROVAL, listAutomationAICapabilityIds };
