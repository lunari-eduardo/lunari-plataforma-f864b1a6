import { capabilityToAITool, listCapabilities, type AICapabilityTool } from "@/shared/capability";
import type { AuthUser } from "@/shared/ports";
import {
  AI_DECISION_ALLOWED,
  canUserRun,
  needsHumanApproval,
  listDecisionAICapabilityIds,
  REQUIRES_APPROVAL,
} from "./permissions";

export interface DecisionAITool extends AICapabilityTool {
  needsApproval: boolean;
  permissions: string[];
}

export function listDecisionAITools(opts?: {
  user?: AuthUser | null;
  kind?: "command" | "query";
}): DecisionAITool[] {
  const caps = listCapabilities({ module: "decision", kind: opts?.kind }).filter((c) =>
    AI_DECISION_ALLOWED.has(c.id),
  );
  const filtered =
    opts?.user === undefined ? caps : caps.filter((c) => canUserRun(opts.user!, c.id));
  return filtered.map((c) => ({
    ...capabilityToAITool(c),
    needsApproval: needsHumanApproval(c.id),
    permissions: c.permissions,
  }));
}

export { REQUIRES_APPROVAL, listDecisionAICapabilityIds };
