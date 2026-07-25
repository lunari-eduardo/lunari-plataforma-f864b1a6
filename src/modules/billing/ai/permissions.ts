import type { AuthUser } from "@/shared/ports";
import { getCapability, listCapabilities } from "@/shared/capability";
import {
  registerModuleApprovals,
  needsHumanApproval as centralNeedsApproval,
} from "@/shared/ai/approvalRegistry";

export const REQUIRES_APPROVAL: ReadonlySet<string> = new Set([
  "billing.createGalleryPayment",
  "billing.registerManualPayment",
]);

registerModuleApprovals({ module: "billing", requireApproval: REQUIRES_APPROVAL });

export function listBillingCapabilityIds(): string[] {
  return listCapabilities({ module: "billing" }).map((c) => c.id);
}

export function canUserRun(user: AuthUser | null, capabilityId: string): boolean {
  if (!user) return false;
  const cap = getCapability(capabilityId);
  if (!cap) return false;
  return cap.id.startsWith("billing.");
}

export function needsHumanApproval(capabilityId: string): boolean {
  return centralNeedsApproval(capabilityId) || REQUIRES_APPROVAL.has(capabilityId);
}
