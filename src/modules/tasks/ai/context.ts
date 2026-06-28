/**
 * Snapshot de contexto da página Tarefas para o Assistente Lu.
 *
 * Onda 6 — superfície de IA.
 *
 * Serializado e injetado no prompt para que o agente conheça o estado
 * visível ANTES de propor ações. Não é fonte de verdade — reflete o store
 * local. Operações devem sempre passar pelas capabilities (`tasks.*`).
 */

import type { AuthUser } from "@/shared/ports";
import { tasksStore } from "../presentation/store/tasksStore";
import { taskStatusesStore } from "../presentation/store/taskStatusesStore";
import { counters, filterTasks } from "../domain/selectors";
import type { TaskFiltersState } from "../domain/types";
import { listTasksCapabilityIds } from "./permissions";

export interface TasksPageSnapshot {
  version: 1;
  route: "/tarefas";
  view: "kanban" | "list";
  filters: TaskFiltersState;
  selection: { taskId: string | null };
  visibleTaskIds: string[];
  counts: {
    total: number;
    open: number;
    done: number;
    overdue: number;
    byStatus: Record<string, number>;
  };
  statuses: Array<{ key: string; label: string; isDone: boolean }>;
  permissions: {
    canWrite: boolean;
    canDelete: boolean;
    isAuthenticated: boolean;
  };
  capabilities: string[];
  userTz: string;
}

export interface BuildTasksSnapshotInput {
  user: AuthUser | null;
  view?: "kanban" | "list";
  filters?: Partial<TaskFiltersState>;
  selection?: { taskId: string | null };
  /** Limite de ids visíveis para não estourar o prompt (default: 30). */
  maxVisible?: number;
}

const DEFAULT_FILTERS: TaskFiltersState = {
  search: "",
  status: "all",
  priority: "all",
  assignee: "all",
  dateRange: "all",
};

export function buildTasksPageSnapshot(input: BuildTasksSnapshotInput): TasksPageSnapshot {
  const { user, view = "kanban", filters, selection, maxVisible = 30 } = input;
  const mergedFilters: TaskFiltersState = { ...DEFAULT_FILTERS, ...(filters ?? {}) };

  const all = tasksStore.getAll();
  const statuses = taskStatusesStore.getAll();
  const visible = filterTasks(all, mergedFilters, statuses);

  const byStatus: Record<string, number> = {};
  for (const s of statuses) byStatus[s.key] = 0;
  for (const t of visible) byStatus[t.status] = (byStatus[t.status] ?? 0) + 1;

  return {
    version: 1,
    route: "/tarefas",
    view,
    filters: mergedFilters,
    selection: { taskId: selection?.taskId ?? null },
    visibleTaskIds: visible.slice(0, maxVisible).map((t) => t.id),
    counts: {
      total: counters.total(visible),
      open: counters.open(visible, statuses),
      done: counters.done(visible, statuses),
      overdue: counters.overdue(visible, statuses),
      byStatus,
    },
    statuses: statuses.map((s) => ({
      key: s.key,
      label: s.label,
      isDone: !!s.isDone,
    })),
    permissions: {
      canWrite: !!user,
      canDelete: !!user,
      isAuthenticated: !!user,
    },
    capabilities: listTasksCapabilityIds(),
    userTz: "America/Sao_Paulo",
  };
}

/** Versão enxuta para logs. */
export function debugTasksSnapshot(snapshot: TasksPageSnapshot): Record<string, unknown> {
  return {
    route: snapshot.route,
    view: snapshot.view,
    counts: snapshot.counts,
    visible: snapshot.visibleTaskIds.length,
    capabilities: snapshot.capabilities.length,
  };
}

/** Helper rápido com filtros padrão. */
export function snapshotForTasks(user: AuthUser | null): TasksPageSnapshot {
  return buildTasksPageSnapshot({ user });
}
