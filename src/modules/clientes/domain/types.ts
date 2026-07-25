/**
 * Tipos de domínio — Módulo Clientes (CRM).
 *
 * Manter mínimo até que capabilities sejam introduzidas. Snapshot de IA
 * consome apenas os campos abaixo; escrita futura passará por Zod schemas
 * definidos aqui.
 */

export type ClienteOrigem =
  | "lead"
  | "manual"
  | "gallery"
  | "workflow"
  | "importacao"
  | "desconhecido";

export interface ClienteResumo {
  id: string;
  nome: string;
  email?: string | null;
  telefone?: string | null;
  origem?: ClienteOrigem | null;
  ativo?: boolean;
  ultimaSessaoAt?: string | null; // ISO
  totalSessoes?: number;
  saldoCreditos?: number;
}

export interface ClienteFiltros {
  search: string;
  origem: ClienteOrigem | "all";
  status: "ativos" | "inativos" | "all";
}
