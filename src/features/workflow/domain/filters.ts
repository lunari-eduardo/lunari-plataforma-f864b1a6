/**
 * Domain — filtros puros sobre WorkflowSession[].
 * Sem React, sem Supabase. Recebe coleção, devolve coleção (referência nova
 * apenas se algum predicado mudou).
 */

import type { WorkflowSession } from "./session";
import { derivePaymentFilterStatus, type PaymentFilterStatus } from "./payment";
import { toCentavos } from "./money";

const removeAccents = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

export interface WorkflowFilterInput {
  search?: string;
  categoria?: string;
  situacao?: "todos" | PaymentFilterStatus;
  /** "YYYY-MM" — quando informado, restringe ao mês. */
  monthKey?: string;
}

function matchesSearch(s: WorkflowSession, needle: string): boolean {
  if (!needle) return true;
  const target = removeAccents(
    [s.clientes?.nome, s.clientes?.email, s.descricao, s.detalhes, s.categoria, s.pacote]
      .filter(Boolean)
      .join(" ")
      .toLowerCase(),
  );
  return target.includes(removeAccents(needle.toLowerCase()));
}

function matchesCategoria(s: WorkflowSession, categoria: string): boolean {
  if (!categoria) return true;
  return (s.categoria || "").toLowerCase() === categoria.toLowerCase();
}

function matchesSituacao(s: WorkflowSession, situacao: WorkflowFilterInput["situacao"]): boolean {
  if (!situacao || situacao === "todos") return true;
  const ds = derivePaymentFilterStatus(toCentavos(s.valor_total ?? 0), toCentavos(s.valor_pago ?? 0));
  return ds === situacao;
}

function matchesMonth(s: WorkflowSession, monthKey?: string): boolean {
  if (!monthKey) return true;
  if (!s.data_sessao) return false;
  const [y, m] = s.data_sessao.split("-");
  return `${y}-${m}` === monthKey;
}

export function applyFilters(sessions: WorkflowSession[], input: WorkflowFilterInput): WorkflowSession[] {
  const search = (input.search ?? "").trim();
  if (!search && !input.categoria && (!input.situacao || input.situacao === "todos") && !input.monthKey) {
    return sessions;
  }
  return sessions.filter(
    (s) =>
      matchesMonth(s, input.monthKey) &&
      matchesSearch(s, search) &&
      matchesCategoria(s, input.categoria ?? "") &&
      matchesSituacao(s, input.situacao),
  );
}

/** Contagens para o header de filtros (sem alocar arrays intermediários). */
export function countSituacao(sessions: WorkflowSession[]): {
  total: number;
  pago: number;
  pendente: number;
} {
  let pago = 0;
  let pendente = 0;
  for (const s of sessions) {
    const ds = derivePaymentFilterStatus(toCentavos(s.valor_total ?? 0), toCentavos(s.valor_pago ?? 0));
    if (ds === "pago") pago++;
    else pendente++;
  }
  return { total: sessions.length, pago, pendente };
}
