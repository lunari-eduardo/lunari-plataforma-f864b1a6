import type { AuthUser } from "@/shared/ports";
import { getCapability, listCapabilities } from "@/shared/capability";

/**
 * Permissions do módulo Formulários para o Assistente Lu.
 *
 * P4 — Paridade AI (foundation). Nenhuma capability registrada ainda.
 * O gate humano já está reservado para as ações irreversíveis:
 *
 *  - publishForm / unpublishForm: alteram URL pública consumida por clientes.
 *  - deleteForm / deleteResponse: remoção definitiva de dados de terceiros.
 *  - closeSubmission / reopenSubmission: mudam o estado de uma resposta já
 *    enviada; reabrir pode gerar novas cobranças/tarefas.
 *  - generateAIBriefing: gera conteúdo com IA sobre resposta do cliente —
 *    exige aprovação para evitar mensagens indevidas.
 */

export const REQUIRES_APPROVAL: ReadonlySet<string> = new Set([
  "formularios.publishForm",
  "formularios.unpublishForm",
  "formularios.deleteForm",
  "formularios.deleteResponse",
  "formularios.reopenSubmission",
  "formularios.generateAIBriefing",
]);

export function listFormulariosCapabilityIds(): string[] {
  return listCapabilities({ module: "formularios" }).map((c) => c.id);
}

export function canUserRun(user: AuthUser | null, capabilityId: string): boolean {
  if (!user) return false;
  const cap = getCapability(capabilityId);
  if (!cap) return false;
  return cap.id.startsWith("formularios.");
}

export function needsHumanApproval(capabilityId: string): boolean {
  return REQUIRES_APPROVAL.has(capabilityId);
}
