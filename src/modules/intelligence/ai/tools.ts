import { capabilityToAITool, listCapabilities, type AICapabilityTool } from "@/shared/capability";
import type { AuthUser } from "@/shared/ports";
import {
  AI_INTELLIGENCE_ALLOWED,
  canUserRun,
  needsHumanApproval,
  listIntelligenceAICapabilityIds,
  REQUIRES_APPROVAL,
} from "./permissions";

export interface IntelligenceAITool extends AICapabilityTool {
  needsApproval: boolean;
  permissions: string[];
}

export function listIntelligenceAITools(opts?: {
  user?: AuthUser | null;
  kind?: "command" | "query";
}): IntelligenceAITool[] {
  const caps = listCapabilities({ module: "intelligence", kind: opts?.kind }).filter((c) =>
    AI_INTELLIGENCE_ALLOWED.has(c.id),
  );
  const filtered =
    opts?.user === undefined ? caps : caps.filter((c) => canUserRun(opts.user!, c.id));
  return filtered.map((c) => ({
    ...capabilityToAITool(c),
    needsApproval: needsHumanApproval(c.id),
    permissions: c.permissions,
  }));
}

export { REQUIRES_APPROVAL, listIntelligenceAICapabilityIds };
