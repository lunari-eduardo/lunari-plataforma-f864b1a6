import type { SessionData } from "@/types/workflow";

const MONTH_NAMES_LOWER = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

export function formatDateGroupHeader(dateString?: string | null): string {
  if (!dateString || typeof dateString !== "string") return "Sem data definida";

  const parts = dateString.split("-");
  if (parts.length !== 3) return dateString;

  const day = parseInt(parts[2], 10);
  const monthIdx = parseInt(parts[1], 10) - 1;

  if (isNaN(day) || monthIdx < 0 || monthIdx > 11) return dateString;

  return `${day} de ${MONTH_NAMES_LOWER[monthIdx]}`;
}

export function formatFullDateLong(dateString?: string | null): string {
  if (!dateString || typeof dateString !== "string") return "Data não informada";

  const parts = dateString.split("-");
  if (parts.length !== 3) return dateString;

  const day = parseInt(parts[2], 10);
  const monthIdx = parseInt(parts[1], 10) - 1;
  const year = parts[0];

  if (isNaN(day) || monthIdx < 0 || monthIdx > 11) return dateString;

  return `${day} de ${MONTH_NAMES_LOWER[monthIdx]} de ${year}`;
}

export function formatCurrencyBRL(value: unknown): string {
  const num = Number(value) || 0;
  return `R$ ${num.toFixed(2).replace(".", ",")}`;
}

export function parseMoneyValue(val: unknown): number {
  if (typeof val === "number") return isNaN(val) ? 0 : val;
  const str = String(val ?? "0");
  const isNeg = /-/.test(str);
  const cleaned = str.replace(/[^\d,]/g, "").replace(",", ".");
  const n = parseFloat(cleaned) || 0;
  return isNeg ? -n : n;
}

export interface DateGroupedSessions {
  dateKey: string;
  displayDate: string;
  sessions: SessionData[];
}

/**
 * Agrupa sessões por data preservando a ordenação das sessões.
 * Se a lista já estiver ordenada por data, agrupa os blocos contínuos.
 * Se houver ordenação arbitrária (ex.: nome), agrupa preservando as sessões.
 */
export function groupSessionsByDate(sessions: SessionData[]): DateGroupedSessions[] {
  const groupsMap = new Map<string, SessionData[]>();

  for (const s of sessions) {
    const key = s.data || "__sem_data__";
    const existing = groupsMap.get(key);
    if (existing) {
      existing.push(s);
    } else {
      groupsMap.set(key, [s]);
    }
  }

  const result: DateGroupedSessions[] = [];
  for (const [key, items] of groupsMap.entries()) {
    result.push({
      dateKey: key,
      displayDate: key === "__sem_data__" ? "Sem data definida" : formatDateGroupHeader(key),
      sessions: items,
    });
  }

  return result;
}
