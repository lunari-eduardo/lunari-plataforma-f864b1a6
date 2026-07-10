import { capabilityToAITool, listCapabilities, type AICapabilityTool } from "@/shared/capability";
import type { AuthUser } from "@/shared/ports";
import { canUserRun, needsHumanApproval, listBillingCapabilityIds, REQUIRES_APPROVAL } from "./permissions";

export interface BillingAITool extends AICapabilityTool {
  needsApproval: boolean;
  permissions: string[];
}

export function listBillingAITools(opts?: {
  user?: AuthUser | null;
  kind?: "command" | "query";
}): BillingAITool[] {
  const caps = listCapabilities({ module: "billing", kind: opts?.kind });
  const filtered =
    opts?.user === undefined ? caps : caps.filter((c) => canUserRun(opts.user!, c.id));
  return filtered.map((c) => ({
    ...capabilityToAITool(c),
    needsApproval: needsHumanApproval(c.id),
    permissions: c.permissions,
  }));
}

export { REQUIRES_APPROVAL, listBillingCapabilityIds };
