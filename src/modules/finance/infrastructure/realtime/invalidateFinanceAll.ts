/**
 * invalidateFinanceAll — invalida TODAS as chaves de React Query que dependem
 * de transações financeiras.
 *
 * Ponto único de verdade para invalidação. Consumido por:
 *  - `useFinancialTransactionsSupabase` (mutations criar/atualizar/remover/marcarPago)
 *  - `FinanceRealtimeBridge` (eventos realtime de `fin_transactions`)
 *  - `LancamentoDrawerProvider` (pós-lançamento)
 *
 * Manter a lista aqui — nunca duplicar em callers.
 */
import type { QueryClient } from "@tanstack/react-query";

const FINANCE_QUERY_KEYS: readonly (readonly unknown[])[] = [
  ["financial-transactions"],
  ["extrato-unificado"],
  ["extrato"],
  ["extrato-receita-prevista-sessoes"],
  ["demonstrativo-financeiro-v3"],
  ["dashboard-transactions-period"],
  ["dashboard-available-years"],
  ["dashboard-financeiro"],
  ["finance", "opening-balance"],
  ["finance", "saldo-ate"],
  ["finance", "kpisByNature"],
  ["finance", "kpisByNatureRange"],
  ["transacoes"],
  ["workflow-metrics"],
  ["workflow-metrics-by-year"],
  ["clientes-sessoes"],
];

export function invalidateFinanceAll(qc: QueryClient) {
  for (const key of FINANCE_QUERY_KEYS) {
    qc.invalidateQueries({ queryKey: key as unknown[] });
  }
}

/**
 * Força refetch imediato das queries ativas do dashboard, sem esperar staleTime.
 * Usar em casos onde o usuário fez uma ação destrutiva (delete) e precisa ver
 * o card do topo atualizar antes de mudar de rota.
 */
export function refetchDashboardActive(qc: QueryClient) {
  qc.refetchQueries({ queryKey: ["dashboard-transactions-period"], type: "active" });
  qc.refetchQueries({ queryKey: ["dashboard-financeiro"], type: "active" });
}
