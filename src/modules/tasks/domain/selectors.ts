/**
 * Selectors puros sobre coleção de Tasks.
 * Sem React, sem Supabase, sem mutações.
 */

import { dueBucket, isDone, isTerminalStatus } from "./rules";
import type { DueBucket, Task, TaskFiltersState, TaskStatusDef, TaskStatusKey } from "./types";

export function byStatus(tasks: Task[], statuses: TaskStatusDef[]): Record<TaskStatusKey, Task[]> {
  const out: Record<TaskStatusKey, Task[]> = {};
  for (const s of statuses) out[s.key] = [];
  for (const t of tasks) {
    (out[t.status] ||= []).push(t);
  }
  return out;
}

export function byAssignee(tasks: Task[]): Record<string, Task[]> {
  const out: Record<string, Task[]> = {};
  for (const t of tasks) {
    const key = t.assigneeId ?? t.assigneeName ?? "__unassigned__";
    (out[key] ||= []).push(t);
  }
  return out;
}

export function byDueBucket(tasks: Task[], now: Date = new Date()): Record<DueBucket, Task[]> {
  const out: Record<DueBucket, Task[]> = {
    overdue: [],
    today: [],
    tomorrow: [],
    week: [],
    later: [],
    none: [],
  };
  for (const t of tasks) out[dueBucket(t.dueDate, now)].push(t);
  return out;
}

export function search(tasks: Task[], q: string): Task[] {
  if (!q) return tasks;
  const lower = q.toLowerCase();
  return tasks.filter((t) => {
    if (t.title.toLowerCase().includes(lower)) return true;
    if (t.description?.toLowerCase().includes(lower)) return true;
    if (t.tags?.some((tag) => tag.toLowerCase().includes(lower))) return true;
    return false;
  });
}

export function countsByStatus(tasks: Task[], statuses: TaskStatusDef[]): Record<TaskStatusKey, number> {
  const grouped = byStatus(tasks, statuses);
  const out: Record<TaskStatusKey, number> = {};
  for (const k of Object.keys(grouped)) out[k] = grouped[k].length;
  return out;
}

export function filterTasks(
  tasks: Task[],
  filters: TaskFiltersState,
  statuses: TaskStatusDef[],
  now: Date = new Date(),
): Task[] {
  return tasks.filter((task) => {
    // Esconde itens-checklist soltos (paridade com a regra atual da página).
    if (task.type === "checklist" && (!task.activeSections || task.activeSections.length === 1)) {
      return false;
    }
    if (filters.search) {
      const s = filters.search.toLowerCase();
      const inTitle = task.title.toLowerCase().includes(s);
      const inDesc = task.description?.toLowerCase().includes(s) ?? false;
      const inTags = task.tags?.some((t) => t.toLowerCase().includes(s)) ?? false;
      if (!inTitle && !inDesc && !inTags) return false;
    }
    if (filters.status !== "all" && task.status !== filters.status) return false;
    if (filters.priority !== "all" && task.priority !== filters.priority) return false;
    if (filters.assignee !== "all" && task.assigneeId !== filters.assignee) return false;

    if (filters.dateRange !== "all") {
      if (!task.dueDate) return false;
      const bucket = dueBucket(task.dueDate, now);
      switch (filters.dateRange) {
        case "today":
          return bucket === "today";
        case "week":
          return bucket === "today" || bucket === "tomorrow" || bucket === "week";
        case "month": {
          const due = new Date(task.dueDate);
          const monthAhead = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
          return due <= monthAhead;
        }
        case "overdue":
          return bucket === "overdue" && !isTerminalStatus(task.status, statuses);
        default:
          return true;
      }
    }
    return true;
  });
}

export const counters = {
  total: (tasks: Task[]) => tasks.length,
  done: (tasks: Task[], statuses: TaskStatusDef[]) => tasks.filter((t) => isDone(t, statuses)).length,
  open: (tasks: Task[], statuses: TaskStatusDef[]) => tasks.filter((t) => !isDone(t, statuses)).length,
  overdue: (tasks: Task[], statuses: TaskStatusDef[], now: Date = new Date()) =>
    tasks.filter((t) => !isDone(t, statuses) && dueBucket(t.dueDate, now) === "overdue").length,
};
