import type { AuthUser } from "@/shared/ports";

export const AI_AUTOMATION_ALLOWED = new Set<string>([
  "automation.rules.list",
  "automation.rules.upsert",
  "automation.rules.delete",
  "automation.runs.list",
  "automation.tick",
]);

/**
 * Toda escrita em regras exige aprovação humana — regras controlam quem
 * pode auto-executar. `tick` também exige, para evitar que a IA dispare
 * automações em cadeia sem consentimento explícito.
 */
export const REQUIRES_APPROVAL = new Set<string>([
  "automation.rules.upsert",
  "automation.rules.delete",
  "automation.tick",
]);

export function canUserRun(_user: AuthUser | null, capabilityId: string): boolean {
  return AI_AUTOMATION_ALLOWED.has(capabilityId);
}

export function needsHumanApproval(capabilityId: string): boolean {
  return REQUIRES_APPROVAL.has(capabilityId);
}

export function listAutomationAICapabilityIds(): string[] {
  return Array.from(AI_AUTOMATION_ALLOWED);
}
