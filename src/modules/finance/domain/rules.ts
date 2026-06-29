/**
 * Regras puras do módulo Finance.
 * Sem I/O, sem dependências de React/Supabase.
 */

import type { Grupo, Transacao } from "./types";

export const GRUPOS_DESPESA: Grupo[] = [
  "Despesa Fixa",
  "Despesa Variável",
  "Investimento",
];

export const GRUPOS_RECEITA: Grupo[] = [
  "Receita Operacional",
  "Receita Não Operacional",
];

export function isDespesa(grupo: Grupo): boolean {
  return GRUPOS_DESPESA.includes(grupo);
}

export function isReceita(grupo: Grupo): boolean {
  return GRUPOS_RECEITA.includes(grupo);
}

/** Status é derivado por trigger no banco — nunca enviar no payload de write. */
export const CAMPOS_PROIBIDOS_NO_WRITE = ["status", "status_financeiro", "valor_pago", "valor_total"] as const;

/** Valida payload de criação de transação no domínio. */
export function isValidTransacaoCreate(input: {
  itemId?: string;
  valor?: number;
  dataVencimento?: string;
}): boolean {
  if (!input.itemId) return false;
  if (typeof input.valor !== "number" || !(input.valor > 0)) return false;
  if (!input.dataVencimento || !/^\d{4}-\d{2}-\d{2}$/.test(input.dataVencimento)) return false;
  return true;
}

/** Normaliza nome de item (idempotência por `lower(nome)`). */
export function normalizeItemName(nome: string): string {
  return nome.trim().toLowerCase();
}

export function isTransacaoPaga(t: Transacao): boolean {
  return t.status === "Pago";
}
