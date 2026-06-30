/**
 * Onda A — KPIs baseados em Natureza.
 *
 * Cálculo de KPIs independente do nome da categoria — usa o vínculo
 * Categoria (fin_items_master.group_code) → Grupo → Natureza.
 *
 * Coexiste com `selectors.ts` legado (grupo enum) até a Onda E (cleanup).
 */

import type { Transacao, ItemFinanceiro } from "./types";
import type { GroupCode } from "./group";
import { GROUPS } from "./group";
import { isGastoNature, isReceitaNature, type NatureCode } from "./nature";

/** ItemFinanceiro estendido com group_code/is_system/archived_at (campos novos da Onda A). */
export interface ItemFinanceiroExt extends Omit<ItemFinanceiro, "groupCode"> {
  groupCode?: GroupCode | string | null;
  isSystem?: boolean;
  archivedAt?: string | null;
}

export interface GastoBreakdownEntry {
  natureCode: NatureCode;
  label: string;
  total: number;
  count: number;
}

export interface DashboardKpisByNature {
  receita: {
    operacional: number;
    financeira: number;
    total: number;
  };
  gastos: {
    operacional: number;
    investimentos: number;
    impostos: number;
    proLabore: number;
    distribuicao: number;
    financiamentos: number;
    total: number;
    breakdown: GastoBreakdownEntry[];
  };
  neutro: {
    transferencias: number;
    aplicacoes: number;
    emprestimos: number;
  };
  lucroLiquido: number;
  margemLiquida: number;
}

const NATURE_LABEL: Record<NatureCode, string> = {
  receita_operacional: "Receita Operacional",
  receita_financeira: "Receita Financeira",
  despesa_operacional: "Despesa Operacional",
  investimento_ativos: "Investimentos",
  impostos: "Impostos",
  pro_labore: "Pró-labore",
  distribuicao_lucros: "Distribuição de Lucros",
  transferencia: "Transferências",
  emprestimo: "Empréstimos",
  financiamento: "Financiamentos",
  aplicacao_financeira: "Aplicações Financeiras",
};

/**
 * Resolve a Natureza de uma transação a partir do item + group_code.
 * Fallback: se a categoria ainda não tem group_code (dado legado),
 * mapeia pelo campo `grupo` antigo para uma natureza razoável.
 */
function resolveNature(item: ItemFinanceiroExt): NatureCode {
  if (item.groupCode && GROUPS[item.groupCode]) {
    return GROUPS[item.groupCode].natureCode;
  }
  // Fallback legado
  switch (item.grupo) {
    case "Receita Operacional":     return "receita_operacional";
    case "Receita Não Operacional": return "receita_financeira";
    case "Despesa Fixa":
    case "Despesa Variável":        return "despesa_operacional";
    case "Investimento":            return "investimento_ativos";
    default:                        return "despesa_operacional";
  }
}

export function computeKpisByNature(
  transacoes: Transacao[],
  itensById: Map<string, ItemFinanceiroExt>,
): DashboardKpisByNature {
  const totalsByNature = new Map<NatureCode, { total: number; count: number }>();

  for (const t of transacoes) {
    const item = itensById.get(t.itemId);
    if (!item) continue;

    const nature = resolveNature(item);
    const valor = t.valorTotal ?? t.valor;
    const pago = t.valorPago ?? (t.status === "Pago" ? valor : 0);

    // Receitas: usar valor pago (regime caixa coerente com KPI atual)
    // Gastos: usar valor total (previsto/competência) — alinhado ao Dashboard antigo
    const amount = isReceitaNature(nature) ? pago : valor;

    const cur = totalsByNature.get(nature) ?? { total: 0, count: 0 };
    cur.total += amount;
    cur.count += 1;
    totalsByNature.set(nature, cur);
  }

  const get = (n: NatureCode) => totalsByNature.get(n)?.total ?? 0;

  const receitaOperacional = get("receita_operacional");
  const receitaFinanceira = get("receita_financeira");
  const receitaTotal = receitaOperacional + receitaFinanceira;

  const gOperacional = get("despesa_operacional");
  const gInvestimento = get("investimento_ativos");
  const gImpostos = get("impostos");
  const gProLabore = get("pro_labore");
  const gDistribuicao = get("distribuicao_lucros");
  const gFinanciamentos = get("financiamento");
  const gastosTotal = gOperacional + gInvestimento + gImpostos + gProLabore + gDistribuicao + gFinanciamentos;

  const breakdown: GastoBreakdownEntry[] = [];
  for (const [code, v] of totalsByNature) {
    if (isGastoNature(code)) {
      breakdown.push({ natureCode: code, label: NATURE_LABEL[code], total: v.total, count: v.count });
    }
  }
  breakdown.sort((a, b) => b.total - a.total);

  const lucroLiquido = receitaTotal - gastosTotal;
  const margemLiquida = receitaTotal > 0 ? (lucroLiquido / receitaTotal) * 100 : 0;

  return {
    receita: {
      operacional: receitaOperacional,
      financeira: receitaFinanceira,
      total: receitaTotal,
    },
    gastos: {
      operacional: gOperacional,
      investimentos: gInvestimento,
      impostos: gImpostos,
      proLabore: gProLabore,
      distribuicao: gDistribuicao,
      financiamentos: gFinanciamentos,
      total: gastosTotal,
      breakdown,
    },
    neutro: {
      transferencias: get("transferencia"),
      aplicacoes: get("aplicacao_financeira"),
      emprestimos: get("emprestimo"),
    },
    lucroLiquido,
    margemLiquida,
  };
}
