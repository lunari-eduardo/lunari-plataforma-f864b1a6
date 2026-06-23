/**
 * Selectors derivados do store. Puros, sem React.
 * Onda 1: apenas wrappers; memoização real chega na Onda 5 com useSyncExternalStore.
 */

import type { WorkflowSession } from "../domain/session";
import { applyFilters, countSituacao, type WorkflowFilterInput } from "../domain/filters";
import { sortSessions, type SortDirection, type WorkflowSortField } from "../domain/sort";
import { toCentavos, fromCentavos } from "../domain/money";
import { workflowStore } from "./workflowStore";

export function selectMonthSessions(year: number, month: number): WorkflowSession[] {
  return workflowStore.getMonth(year, month);
}

export function selectFilteredSorted(
  year: number,
  month: number,
  filter: WorkflowFilterInput,
  sortField: WorkflowSortField,
  sortDirection: SortDirection,
): WorkflowSession[] {
  const base = selectMonthSessions(year, month);
  const filtered = applyFilters(base, filter);
  return sortSessions(filtered, sortField, sortDirection);
}

export interface MonthMetrics {
  previsto: number;
  recebido: number;
  restante: number;
  sessoes: number;
}

export function selectMonthMetrics(year: number, month: number): MonthMetrics {
  const list = selectMonthSessions(year, month);
  let previstoC = 0;
  let recebidoC = 0;
  for (const s of list) {
    previstoC += toCentavos(s.valor_total ?? 0);
    recebidoC += toCentavos(s.valor_pago ?? 0);
  }
  return {
    previsto: fromCentavos(previstoC),
    recebido: fromCentavos(recebidoC),
    restante: fromCentavos(previstoC - recebidoC),
    sessoes: list.length,
  };
}

export function selectSituacaoCounts(year: number, month: number) {
  return countSituacao(selectMonthSessions(year, month));
}
