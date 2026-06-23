/**
 * Domain — ordenadores puros sobre WorkflowSession.
 * Comparadores trabalham diretamente sobre o shape canônico (sem regex de moeda).
 */

import type { WorkflowSession } from "./session";
import { toReais } from "./money";

export type SortDirection = "asc" | "desc";

export type WorkflowSortField =
  | "date"
  | "client"
  | "status"
  | "category"
  | "package"
  | "extraPhotoQty"
  | "productTotal"
  | "total"
  | "paid"
  | "remaining"
  | "";

const removeAccents = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

function parseHoraToMinutes(hora?: string): number {
  if (!hora) return 0;
  const [h, m] = hora.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

function dateTimestamp(s: WorkflowSession): number {
  if (!s.data_sessao) return 0;
  const [y, mo, d] = s.data_sessao.split("-").map(Number);
  const baseMs = new Date(y || 1970, (mo || 1) - 1, d || 1).getTime();
  return baseMs + parseHoraToMinutes(s.hora_sessao) * 60_000;
}

function getSortValue(s: WorkflowSession, field: WorkflowSortField): string | number {
  switch (field) {
    case "date":
      return dateTimestamp(s);
    case "client":
      return removeAccents((s.clientes?.nome || "").toLowerCase());
    case "status":
      return (s.status || "").toLowerCase();
    case "category":
      return (s.categoria || "").toLowerCase();
    case "package":
      return (s.pacote || "").toLowerCase();
    case "extraPhotoQty":
      return Number(s.qtd_fotos_extra) || 0;
    case "productTotal": {
      const prods = Array.isArray(s.produtos_incluidos) ? (s.produtos_incluidos as any[]) : [];
      return prods.reduce((acc, p) => acc + (Number(p?.quantidade) || 0) * (Number(p?.valorUnitario) || 0), 0);
    }
    case "total":
      return toReais(s.valor_total);
    case "paid":
      return toReais(s.valor_pago);
    case "remaining":
      return toReais(s.valor_total) - toReais(s.valor_pago);
    case "":
    default:
      return 0;
  }
}

/** Ordenação padrão da Agenda: dia desc, hora asc no mesmo dia. */
export function defaultDateSort(a: WorkflowSession, b: WorkflowSession): number {
  const da = dateTimestamp({ ...a, hora_sessao: "00:00" } as WorkflowSession);
  const db = dateTimestamp({ ...b, hora_sessao: "00:00" } as WorkflowSession);
  if (da !== db) return db - da;
  return parseHoraToMinutes(a.hora_sessao) - parseHoraToMinutes(b.hora_sessao);
}

export function sortSessions(
  sessions: WorkflowSession[],
  field: WorkflowSortField,
  direction: SortDirection = "asc",
): WorkflowSession[] {
  if (!field) {
    return [...sessions].sort(defaultDateSort);
  }
  const mult = direction === "asc" ? 1 : -1;
  return [...sessions].sort((a, b) => {
    const av = getSortValue(a, field);
    const bv = getSortValue(b, field);
    if (av < bv) return -1 * mult;
    if (av > bv) return 1 * mult;
    return 0;
  });
}
