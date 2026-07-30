import type { AuthUser } from "@/shared/ports";
import { getCapability, listCapabilities } from "@/shared/capability";
import {
  registerModuleApprovals,
  needsHumanApproval as centralNeedsApproval,
} from "@/shared/ai/approvalRegistry";

/**
 * Permissions do módulo Configurações para o Assistente Lu (Onda D.1).
 * Gate humano para ações destrutivas / de alto impacto global.
 */
export const REQUIRES_APPROVAL: ReadonlySet<string> = new Set([
  "configuracoes.deleteCategoria",
  "configuracoes.deletePacote",
  "configuracoes.deleteProduto",
  "configuracoes.deleteEtapa",
  "configuracoes.deleteContratoTemplate",
]);

/**
 * B2: os ids legados `configuracoes.setPricingModel`,
 * `configuracoes.updateGlobalPricingTable` e
 * `configuracoes.setCategoriaPricingTable` eram órfãos (nunca existiram como
 * capability registrada). A precificação agora vive no módulo `precificacao`
 * (`precificacao.setModelo`, `precificacao.upsertTabelaGlobal`,
 * `precificacao.upsertTabelaCategoria`), com o mesmo gate de aprovação.
 */
export const LEGACY_PRICING_IDS: Readonly<Record<string, string>> = {
  "configuracoes.setPricingModel": "precificacao.setModelo",
  "configuracoes.updateGlobalPricingTable": "precificacao.upsertTabelaGlobal",
  "configuracoes.setCategoriaPricingTable": "precificacao.upsertTabelaCategoria",
};

registerModuleApprovals({ module: "configuracoes", requireApproval: REQUIRES_APPROVAL });

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
  return centralNeedsApproval(capabilityId) || REQUIRES_APPROVAL.has(capabilityId);
}
