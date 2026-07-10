import type { AuthUser } from "@/shared/ports";
import { getCapability, listCapabilities } from "@/shared/capability";

export const REQUIRES_APPROVAL: ReadonlySet<string> = new Set([
  "billing.createGalleryPayment",
  "billing.registerManualPayment",
]);

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
  return REQUIRES_APPROVAL.has(capabilityId);
}
