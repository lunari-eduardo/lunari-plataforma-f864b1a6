import type { AuthUser } from "@/shared/ports";
import { getCapability, listCapabilities } from "@/shared/capability";

/**
 * Permissions do módulo Configurações para o Assistente Lu.
 *
 * P5 — Paridade AI (foundation). Nenhuma capability registrada ainda; o gate
 * humano já está reservado para as ações destrutivas ou de alto impacto global:
 *
 *  - delete{Categoria,Pacote,Produto,Etapa,ContratoTemplate}: remoção com
 *    cascata em sessões/orçamentos/contratos existentes.
 *  - setPricingModel / updateGlobalPricingTable / setCategoriaPricingTable:
 *    alteram regra de preço aplicada a novas sessões (respeitando
 *    congelamento das existentes).
 */

export const REQUIRES_APPROVAL: ReadonlySet<string> = new Set([
  "configuracoes.deleteCategoria",
  "configuracoes.deletePacote",
  "configuracoes.deleteProduto",
  "configuracoes.deleteEtapa",
  "configuracoes.deleteContratoTemplate",
  "configuracoes.setPricingModel",
  "configuracoes.updateGlobalPricingTable",
  "configuracoes.setCategoriaPricingTable",
]);

export function listConfiguracoesCapabilityIds(): string[] {
  return listCapabilities({ module: "configuracoes" }).map((c) => c.id);
}

export function canUserRun(user: AuthUser | null, capabilityId: string): boolean {
  if (!user) return false;
  const cap = getCapability(capabilityId);
  if (!cap) return false;
  return cap.id.startsWith("configuracoes.");
}

export function needsHumanApproval(capabilityId: string): boolean {
  return REQUIRES_APPROVAL.has(capabilityId);
}
