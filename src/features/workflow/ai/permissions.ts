/**
 * Permissões da superfície de IA do Workflow.
 *
 * Onda 6 — superfície tipada para o Assistente de IA.
 *
 * Filosofia (Constituição Lunari v1.0): a IA executa apenas o que o usuário
 * já poderia executar manualmente. Aqui mapeamos cada capability do módulo
 * Workflow ao conjunto mínimo de permissões esperadas. O gate efetivo
 * (RLS + ownership) acontece dentro de cada handler da capability — este
 * módulo serve como contrato declarativo para o adaptador de tools.
 */

import type { AuthUser } from "@/shared/ports";
import { getCapability, listCapabilities } from "@/shared/capability";

/** Conjunto canônico de permissões usadas pelo módulo workflow. */
export const WORKFLOW_PERMISSIONS = [
  "workflow:read",
  "workflow:write",
  "workflow:delete",
  "workflow:refund",
] as const;

export type WorkflowPermission = (typeof WORKFLOW_PERMISSIONS)[number];

/** Capabilities cuja execução SEMPRE exige confirmação humana, mesmo via IA. */
export const REQUIRES_APPROVAL: ReadonlySet<string> = new Set([
  "workflow.deleteSession",
  "workflow.refundPayment",
]);

/** Capabilities expostas à IA. Queries são sempre seguras; commands variam. */
export function listWorkflowCapabilityIds(): string[] {
  return listCapabilities({ module: "workflow" }).map((c) => c.id);
}

/**
 * Verifica se o usuário pode executar a capability. Esta é uma camada
 * declarativa — o handler ainda valida ownership por `user_id` no DB.
 *
 * Política atual: qualquer usuário autenticado pode executar capabilities
 * do próprio workspace. Capabilities marcadas em `REQUIRES_APPROVAL`
 * sempre devolvem `needsApproval = true` no adaptador.
 */
export function canUserRun(user: AuthUser | null, capabilityId: string): boolean {
  if (!user) return false;
  const cap = getCapability(capabilityId);
  if (!cap) return false;
  if (!cap.id.startsWith("workflow.")) return false;
  return true;
}

export function needsHumanApproval(capabilityId: string): boolean {
  return REQUIRES_APPROVAL.has(capabilityId);
}
