import { capabilityToAITool, listCapabilities, type AICapabilityTool } from "@/shared/capability";
import type { AuthUser } from "@/shared/ports";
import {
  AI_LEARNING_ALLOWED,
  canUserRun,
  needsHumanApproval,
  listLearningAICapabilityIds,
  REQUIRES_APPROVAL,
} from "./permissions";

export interface LearningAITool extends AICapabilityTool {
  needsApproval: boolean;
  permissions: string[];
}

export function listLearningAITools(opts?: {
  user?: AuthUser | null;
  kind?: "command" | "query";
}): LearningAITool[] {
  const caps = listCapabilities({ module: "learning", kind: opts?.kind }).filter((c) =>
    AI_LEARNING_ALLOWED.has(c.id),
  );
  const filtered =
    opts?.user === undefined ? caps : caps.filter((c) => canUserRun(opts.user!, c.id));
  return filtered.map((c) => ({
    ...capabilityToAITool(c),
    needsApproval: needsHumanApproval(c.id),
    permissions: c.permissions,
  }));
}

export { REQUIRES_APPROVAL, listLearningAICapabilityIds };
