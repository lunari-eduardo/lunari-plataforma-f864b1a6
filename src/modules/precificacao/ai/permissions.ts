import type { AuthUser } from "@/shared/ports";
import { getCapability, listCapabilities } from "@/shared/capability";
import {
  registerModuleApprovals,
  needsHumanApproval as centralNeedsApproval,
} from "@/shared/ai/approvalRegistry";

/**
 * Permissions do módulo Precificação para o Assistente Lu (Bloco B2).
 *
 * Regra do bloco: LEITURA e SIMULAÇÃO são livres; toda ESCRITA de preço passa
 * por aprovação humana. Preço é decisão de negócio — a Lu propõe, o fotógrafo
 * decide. Simular não grava nada, então nunca exige gate.
 */
export const REQUIRES_APPROVAL: ReadonlySet<string> = new Set([
  "precificacao.setModelo",
  "precificacao.upsertTabelaGlobal",
  "precificacao.upsertTabelaCategoria",
  "precificacao.updatePacotePreco",
  "precificacao.updateMargemEHoras",
  "precificacao.setMetas",
  "precificacao.criarPacotePrecificado",
]);

registerModuleApprovals({
  module: "precificacao",
  requireApproval: REQUIRES_APPROVAL,
});

export function listPrecificacaoCapabilityIds(): string[] {
  return listCapabilities({ module: "precificacao" }).map((c) => c.id);
}

export function canUserRun(user: AuthUser | null, capabilityId: string): boolean {
  if (!user) return false;
  const cap = getCapability(capabilityId);
  if (!cap) return false;
  return cap.id.startsWith("precificacao.");
}

export function needsHumanApproval(capabilityId: string): boolean {
  return centralNeedsApproval(capabilityId) || REQUIRES_APPROVAL.has(capabilityId);
}
