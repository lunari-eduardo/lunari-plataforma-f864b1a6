/**
 * Snapshot de contexto da página Workflow para o Assistente de IA.
 *
 * Onda 6 — superfície de IA.
 *
 * Este snapshot é serializado e injetado no prompt do agente para que ele
 * tenha consciência do estado visível na tela ANTES de propor ações. Não
 * é fonte de verdade — apenas reflete o store local. Operações devem
 * sempre passar pelas capabilities (`workflow.*`), que validam no DB.
 *
 * Formato é estável (versionado em `version`) para que o módulo `ai/` de
 * outras superfícies (chat, autopilot) consuma com contrato claro.
 */

import type { AuthUser } from "@/shared/ports";
import { workflowStore } from "../store/workflowStore";
import {
  selectMonthMetrics,
  selectMonthSessions,
  selectSituacaoCounts,
} from "../store/selectors";
import { listWorkflowCapabilityIds } from "./permissions";

export interface WorkflowPageSnapshot {
  version: 1;
  route: "/workflow";
  currentMonth: { year: number; month: number };
  filters: {
    search: string;
    categoria: string | null;
    situacao: string | null;
    sortField: string;
    sortDirection: "asc" | "desc";
  };
  selection: { sessionId: string | null };
  visibleSessionIds: string[];
  counts: {
    total: number;
    pagas: number;
    pendentes: number;
    parciais: number;
    restanteTotal: number;
    previsto: number;
    recebido: number;
  };
  permissions: {
    canWrite: boolean;
    canDelete: boolean;
    canRefund: boolean;
    isAuthenticated: boolean;
  };
  capabilities: string[];
  userTz: string;
}

export interface BuildSnapshotInput {
  user: AuthUser | null;
  currentMonth: { year: number; month: number };
  filters?: Partial<WorkflowPageSnapshot["filters"]>;
  selection?: { sessionId: string | null };
}

const DEFAULT_FILTERS: WorkflowPageSnapshot["filters"] = {
  search: "",
  categoria: null,
  situacao: null,
  sortField: "data",
  sortDirection: "asc",
};

export function buildWorkflowPageSnapshot(input: BuildSnapshotInput): WorkflowPageSnapshot {
  const { user, currentMonth, filters, selection } = input;
  const { year, month } = currentMonth;

  const sessions = selectMonthSessions(year, month);
  const metrics = selectMonthMetrics(year, month);
  const situacao = selectSituacaoCounts(year, month);

  return {
    version: 1,
    route: "/workflow",
    currentMonth,
    filters: { ...DEFAULT_FILTERS, ...(filters ?? {}) },
    selection: { sessionId: selection?.sessionId ?? null },
    visibleSessionIds: sessions.map((s) => s.id),
    counts: {
      total: sessions.length,
      pagas: situacao.pago ?? 0,
      pendentes: situacao.pendente ?? 0,
      parciais: 0,
      restanteTotal: metrics.restante,
      previsto: metrics.previsto,
      recebido: metrics.recebido,
    },
    permissions: {
      canWrite: !!user,
      canDelete: !!user,
      canRefund: !!user,
      isAuthenticated: !!user,
    },
    capabilities: listWorkflowCapabilityIds(),
    userTz: "America/Sao_Paulo",
  };
}

/** Para depuração: imprime um snapshot mínimo sem dados sensíveis. */
export function debugSnapshot(snapshot: WorkflowPageSnapshot): Record<string, unknown> {
  return {
    route: snapshot.route,
    currentMonth: snapshot.currentMonth,
    counts: snapshot.counts,
    capabilities: snapshot.capabilities.length,
    visible: snapshot.visibleSessionIds.length,
  };
}

/** Helper que pega o store atual e o usuário e devolve o snapshot pronto. */
export function snapshotForActiveMonth(user: AuthUser | null): WorkflowPageSnapshot {
  const now = new Date();
  const current = { year: now.getFullYear(), month: now.getMonth() + 1 };
  return buildWorkflowPageSnapshot({ user, currentMonth: current });
}
