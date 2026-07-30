/**
 * Domínio do módulo Leads (funil comercial — topo de funil do Lunari Studio).
 *
 * Fonte de verdade: tabelas `leads`, `lead_statuses`, `lead_follow_up_config`
 * (RLS por `user_id`). Os tipos aqui são a projeção enxuta usada por
 * capabilities e pela superfície de IA — não substituem `@/types/leads`,
 * consumido pela UI legada.
 */

export interface LeadResumo {
  id: string;
  nome: string;
  status: string | null;
  origem: string | null;
  email: string | null;
  telefone: string | null;
  whatsapp: string | null;
  clienteId: string | null;
  arquivado: boolean;
  needsFollowUp: boolean;
  diasSemInteracao: number | null;
  ultimaInteracao: string | null;
  createdAt: string;
}

export interface LeadStatusDef {
  id: string;
  key: string;
  name: string;
  color: string | null;
  sortOrder: number;
  isConverted: boolean;
  isLost: boolean;
}

export interface LeadFiltros {
  search: string;
  status: string | "all";
  origem: string | "all";
  arquivados: "ocultar" | "incluir" | "somente";
}

export type LeadsView = "kanban" | "list" | "detail";

/** Origens padrão sugeridas — o usuário pode gravar qualquer texto livre. */
export const LEAD_ORIGENS_SUGERIDAS = [
  "instagram",
  "indicacao",
  "google",
  "whatsapp",
  "site",
  "evento",
  "manual",
] as const;
