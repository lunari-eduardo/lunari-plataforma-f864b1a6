import type { AuthUser } from "@/shared/ports";
import { getCapability, listCapabilities } from "@/shared/capability";

/**
 * Superfície de IA do Finance — alinhada ao `plan-finance.md §0`.
 *
 * Escopo Lu:
 *  1. Lançar despesa/receita por categoria + subcategoria.
 *  2. Perguntar quando categoria/subcategoria ambígua.
 *  3. Criar novas subcategorias (`financial_items`).
 *  4. Aceitar modo (único/parcelado/recorrente/cartão) + forma de pagamento.
 *  5. Criar e ler metas.
 *  6. Ler dashboard e extrato.
 *  7. Créditos de cliente (grant/apply/revoke/read).
 *
 * Fora do escopo IA v1: cobranças via gateway, cartões, vendas avulsas,
 * configuração de provedor de pagamento.
 */
export const AI_FINANCE_ALLOWED: ReadonlySet<string> = new Set([
  // Lançamentos
  "finance.transaction.create",
  "finance.transaction.update",
  "finance.transaction.delete",
  "finance.transaction.markPaid",
  "finance.transaction.markPending",
  // Itens (subcategorias) + grupos
  "finance.item.create",
  "finance.category.create",
  // Metas
  "finance.goal.set",
  // Leitura
  "finance.item.list",
  "finance.goal.list",
  "finance.goal.progress",
  "finance.extrato.list",
  "finance.extrato.summary",
  "finance.dashboard.kpis",
  "finance.nature.list",
  "finance.group.list",
  "finance.category.list",
  "finance.kpis.byNature",
  "finance.kpis.byNatureRange",
  // Créditos de cliente
  "finance.credit.get",
  "finance.credit.grant",
  "finance.credit.revoke",
  "finance.credit.apply",
  "finance.credit.listClientsWithCredit",
]);

/**
 * Capabilities que exigem aprovação humana explícita antes de executar.
 * Regra: qualquer ação destrutiva/irreversível ou movimentação de dinheiro
 * do cliente.
 */
export const REQUIRES_APPROVAL: ReadonlySet<string> = new Set([
  "finance.transaction.delete",
  "finance.credit.grant",
  "finance.credit.revoke",
  "finance.credit.apply",
]);

export function listFinanceAICapabilityIds(): string[] {
  return listCapabilities({ module: "finance" })
    .map((c) => c.id)
    .filter((id) => AI_FINANCE_ALLOWED.has(id));
}

export function canUserRun(user: AuthUser | null, capabilityId: string): boolean {
  if (!user) return false;
  if (!AI_FINANCE_ALLOWED.has(capabilityId)) return false;
  return !!getCapability(capabilityId);
}

export function needsHumanApproval(capabilityId: string): boolean {
  return REQUIRES_APPROVAL.has(capabilityId);
}
