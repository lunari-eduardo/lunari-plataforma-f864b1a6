/**
 * Snapshot da página Finanças para o Assistente Lu.
 *
 * Onda F1.2 — build<Finance>PageSnapshot(v1).
 *
 * Serializado e injetado no prompt: dá à Lu consciência do estado
 * visível ANTES de propor ações. Não é fonte de verdade — reflete o store
 * local. Operações devem sempre passar pelas capabilities (`finance.*`).
 *
 * Limites:
 *  - `visibleTransactionIds` ≤ 30
 *  - `items` ≤ 50
 *  - Payload ≤ ~8 KB serializado
 */

import type { AuthUser } from "@/shared/ports";
import { transactionsStore } from "../presentation/store/transactionsStore";
import { itemsStore } from "../presentation/store/itemsStore";
import type { FormaPagamento, Grupo } from "../domain/types";
import { listFinanceAICapabilityIds } from "./permissions";

export type FinanceTab =
  | "lancamentos"
  | "dashboard"
  | "extrato"
  | "metas"
  | "configuracoes";

export type FinanceRegime = "caixa" | "competencia";

export interface FinancePageSnapshot {
  version: 1;
  route: "/financas";
  tab: FinanceTab;
  filtroMesAno: { year: number; month: number };
  regime: FinanceRegime;
  kpis: {
    receitaOperacional: number;
    receitasExtras: number;
    despesas: number;
    lucro: number;
    pendentesReceber: number;
    pendentesPagar: number;
  };
  groupCounts: Record<Grupo, number>;
  visibleTransactionIds: string[];
  items: Array<{ id: string; nome: string; grupo: Grupo }>;
  goalsProgress: {
    metaFaturamento: number;
    realizadoFaturamento: number;
    metaLucro: number;
    realizadoLucro: number;
    progressoFaturamento: number;
    progressoLucro: number;
  } | null;
  extratoSummary: {
    entradas: number;
    saidas: number;
    saldo: number;
    linhas: number;
  } | null;
  formasPagamento: FormaPagamento[];
  permissions: {
    canWrite: boolean;
    canDelete: boolean;
    isAuthenticated: boolean;
  };
  capabilities: string[];
  userTz: string;
  notes: string[];
}

export interface BuildFinanceSnapshotInput {
  user: AuthUser | null;
  tab?: FinanceTab;
  filtroMesAno?: { year: number; month: number };
  regime?: FinanceRegime;
  goalsProgress?: FinancePageSnapshot["goalsProgress"];
  extratoSummary?: FinancePageSnapshot["extratoSummary"];
  /** Limite de ids visíveis (default 30). */
  maxVisible?: number;
  /** Limite de itens (default 50). */
  maxItems?: number;
}

const EMPTY_GROUP_COUNTS: Record<Grupo, number> = {
  "Despesa Fixa": 0,
  "Despesa Variável": 0,
  Investimento: 0,
  "Receita Operacional": 0,
  "Receita Não Operacional": 0,
};

const FORMAS_PAGAMENTO: FormaPagamento[] = [
  "dinheiro",
  "pix",
  "transferencia",
  "boleto",
  "cartao_debito",
  "cartao_credito",
];

export function buildFinancePageSnapshot(
  input: BuildFinanceSnapshotInput,
): FinancePageSnapshot {
  const {
    user,
    tab = "lancamentos",
    regime = "caixa",
    goalsProgress = null,
    extratoSummary = null,
    maxVisible = 30,
    maxItems = 50,
  } = input;

  const now = new Date();
  const filtroMesAno =
    input.filtroMesAno ?? { year: now.getFullYear(), month: now.getMonth() + 1 };

  const allTx = transactionsStore.getAll();
  const allItems = itemsStore.getAll();

  const itemsById = new Map(allItems.map((i) => [i.id, i]));

  // Filtra transações do mês (por dataVencimento)
  const ymPrefix = `${filtroMesAno.year}-${String(filtroMesAno.month).padStart(2, "0")}`;
  const monthTx = allTx.filter((t) => (t.dataVencimento ?? "").startsWith(ymPrefix));

  // KPIs simples derivados do store local
  const kpis = {
    receitaOperacional: 0,
    receitasExtras: 0,
    despesas: 0,
    lucro: 0,
    pendentesReceber: 0,
    pendentesPagar: 0,
  };
  const groupCounts: Record<Grupo, number> = { ...EMPTY_GROUP_COUNTS };

  for (const t of monthTx) {
    const item = itemsById.get(t.itemId);
    if (!item) continue;
    groupCounts[item.grupo] = (groupCounts[item.grupo] ?? 0) + 1;
    const valor = t.valorTotal ?? t.valor ?? 0;
    const pago = t.valorPago ?? 0;
    const pendente = Math.max(0, valor - pago);
    switch (item.grupo) {
      case "Receita Operacional":
        kpis.receitaOperacional += pago;
        kpis.pendentesReceber += pendente;
        break;
      case "Receita Não Operacional":
        kpis.receitasExtras += pago;
        kpis.pendentesReceber += pendente;
        break;
      case "Despesa Fixa":
      case "Despesa Variável":
      case "Investimento":
        kpis.despesas += pago;
        kpis.pendentesPagar += pendente;
        break;
    }
  }
  kpis.lucro = kpis.receitaOperacional + kpis.receitasExtras - kpis.despesas;

  const visibleTransactionIds = monthTx
    .sort((a, b) => (a.dataVencimento < b.dataVencimento ? 1 : -1))
    .slice(0, maxVisible)
    .map((t) => t.id);

  const items = allItems
    .slice(0, maxItems)
    .map((i) => ({ id: i.id, nome: i.nome, grupo: i.grupo }));

  return {
    version: 1,
    route: "/financas",
    tab,
    filtroMesAno,
    regime,
    kpis,
    groupCounts,
    visibleTransactionIds,
    items,
    goalsProgress,
    extratoSummary,
    formasPagamento: FORMAS_PAGAMENTO,
    permissions: {
      canWrite: !!user,
      canDelete: !!user,
      isAuthenticated: !!user,
    },
    capabilities: listFinanceAICapabilityIds(),
    userTz: "America/Sao_Paulo",
    notes: [
      "Ao lançar valor com categoria por nome: chame finance.item.list ANTES. Se 0 match, crie via finance.item.create. Se >1, PERGUNTE ao usuário qual usar.",
      "Nunca envie status/valor_pago/valor_total no payload — são gerados por trigger.",
      "finance.transaction.delete requer aprovação humana explícita.",
      "Metas: use categoria='__geral__' para meta global do mês.",
    ],
  };
}

export function debugFinanceSnapshot(s: FinancePageSnapshot): Record<string, unknown> {
  return {
    route: s.route,
    tab: s.tab,
    filtroMesAno: s.filtroMesAno,
    kpis: s.kpis,
    capabilities: s.capabilities.length,
    visible: s.visibleTransactionIds.length,
    items: s.items.length,
  };
}

export function snapshotForFinance(user: AuthUser | null): FinancePageSnapshot {
  return buildFinancePageSnapshot({ user });
}
