/**
 * Snapshot da página Leads (funil comercial) para o Assistente Lu (v1).
 *
 * Reflete o estado visível no kanban/lista de leads. Não é fonte de verdade —
 * operações devem passar pelas capabilities `leads.*`.
 *
 * Limites: `visibleLeadIds` ≤ 40, `followUpsPendentes` ≤ 10, payload ≤ ~8 KB.
 */
import type { AuthUser } from "@/shared/ports";
import type { LeadFiltros, LeadResumo, LeadStatusDef, LeadsView } from "../domain/types";
import { listLeadsCapabilityIds } from "./permissions";

export interface LeadsPageSnapshot {
  version: 1;
  route: "/leads";
  view: LeadsView;
  filters: LeadFiltros;
  selection: { leadId: string | null };
  counts: {
    total: number;
    porStatus: Record<string, number>;
    arquivados: number;
    convertidos: number;
    followUpPendente: number;
  };
  statuses: Array<{ key: string; name: string; isConverted: boolean; isLost: boolean }>;
  visibleLeadIds: string[];
  followUpsPendentes: Array<{
    id: string;
    nome: string;
    status: string | null;
    diasSemInteracao: number | null;
  }>;
  permissions: {
    canWrite: boolean;
    canConvert: boolean;
    isAuthenticated: boolean;
  };
  capabilities: string[];
  userTz: string;
  notes: string[];
}

export interface BuildLeadsSnapshotInput {
  user: AuthUser | null;
  view?: LeadsView;
  filters?: Partial<LeadFiltros>;
  selection?: { leadId: string | null };
  leads?: LeadResumo[];
  statuses?: LeadStatusDef[];
  maxVisible?: number;
  maxFollowUps?: number;
}

const DEFAULT_FILTERS: LeadFiltros = {
  search: "",
  status: "all",
  origem: "all",
  arquivados: "ocultar",
};

export function buildLeadsPageSnapshot(input: BuildLeadsSnapshotInput): LeadsPageSnapshot {
  const {
    user,
    view = "kanban",
    filters,
    selection,
    leads = [],
    statuses = [],
    maxVisible = 40,
    maxFollowUps = 10,
  } = input;

  const mergedFilters: LeadFiltros = { ...DEFAULT_FILTERS, ...(filters ?? {}) };

  const porStatus: Record<string, number> = {};
  for (const l of leads) {
    const key = l.status ?? "sem_status";
    porStatus[key] = (porStatus[key] ?? 0) + 1;
  }

  const followUpsPendentes = leads
    .filter((l) => l.needsFollowUp && !l.arquivado)
    .sort((a, b) => (b.diasSemInteracao ?? 0) - (a.diasSemInteracao ?? 0))
    .slice(0, maxFollowUps)
    .map((l) => ({
      id: l.id,
      nome: l.nome,
      status: l.status,
      diasSemInteracao: l.diasSemInteracao ?? null,
    }));

  return {
    version: 1,
    route: "/leads",
    view,
    filters: mergedFilters,
    selection: { leadId: selection?.leadId ?? null },
    counts: {
      total: leads.length,
      porStatus,
      arquivados: leads.filter((l) => l.arquivado).length,
      convertidos: leads.filter((l) => !!l.clienteId).length,
      followUpPendente: leads.filter((l) => l.needsFollowUp && !l.arquivado).length,
    },
    statuses: statuses.map((s) => ({
      key: s.key,
      name: s.name,
      isConverted: s.isConverted,
      isLost: s.isLost,
    })),
    visibleLeadIds: leads.slice(0, maxVisible).map((l) => l.id),
    followUpsPendentes,
    permissions: {
      canWrite: !!user,
      canConvert: !!user,
      isAuthenticated: !!user,
    },
    capabilities: listLeadsCapabilityIds(),
    userTz: "America/Sao_Paulo",
    notes: [
      "Os estágios do funil são configuráveis: sempre consultar leads.listStatuses antes de mover um lead.",
      "Perda exige motivo — usar leads.markLost, nunca leads.moveStatus para colunas de perda.",
      "Converter lead em cliente cria cadastro real e exige aprovação humana.",
      "Orçamentos não têm tabela própria: são compromissos de agenda do tipo 'budget' (leads.listOrcamentosAgendados).",
      "Dados de contato são sensíveis: não ecoar telefone/email em respostas amplas.",
    ],
  };
}

export function snapshotForLeads(user: AuthUser | null): LeadsPageSnapshot {
  return buildLeadsPageSnapshot({ user });
}

export function debugLeadsSnapshot(s: LeadsPageSnapshot): Record<string, unknown> {
  return {
    route: s.route,
    view: s.view,
    counts: s.counts,
    visible: s.visibleLeadIds.length,
    followUps: s.followUpsPendentes.length,
    capabilities: s.capabilities.length,
  };
}
