import { capabilityToAITool, listCapabilities, type AICapabilityTool } from "@/shared/capability";
import type { AuthUser } from "@/shared/ports";
import {
  AI_OBSERVATION_ALLOWED,
  canUserRun,
  needsHumanApproval,
  listObservationAICapabilityIds,
  REQUIRES_APPROVAL,
} from "./permissions";

export interface ObservationAITool extends AICapabilityTool {
  needsApproval: boolean;
  permissions: string[];
}

export function listObservationAITools(opts?: {
  user?: AuthUser | null;
  kind?: "command" | "query";
}): ObservationAITool[] {
  const caps = listCapabilities({ module: "observation", kind: opts?.kind }).filter((c) =>
    AI_OBSERVATION_ALLOWED.has(c.id),
  );
  const filtered =
    opts?.user === undefined ? caps : caps.filter((c) => canUserRun(opts.user!, c.id));
  return filtered.map((c) => ({
    ...capabilityToAITool(c),
    needsApproval: needsHumanApproval(c.id),
    permissions: c.permissions,
  }));
}

export { REQUIRES_APPROVAL, listObservationAICapabilityIds };
