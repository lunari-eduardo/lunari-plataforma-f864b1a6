/**
 * Regras puras de domínio. ZERO dependências de React/Supabase.
 */

import type { DueBucket, Task, TaskStatusDef, TaskStatusKey } from "./types";

/** Keys legadas tratadas como terminais quando `task_statuses` ainda não tem `is_terminal`. */
const LEGACY_TERMINAL_KEYS = new Set(["done", "concluido", "concluida", "finalizada", "finalizado"]);

/** Retorna o status terminal (preferindo o marcado como `isTerminal`). */
export function findTerminalStatus(statuses: TaskStatusDef[]): TaskStatusDef | undefined {
  return (
    statuses.find((s) => s.isTerminal) ??
    statuses.find((s) => LEGACY_TERMINAL_KEYS.has(s.key.toLowerCase()))
  );
}

/** Status é terminal? Usa `is_terminal` quando disponível, com fallback legado. */
export function isTerminalStatus(key: TaskStatusKey, statuses: TaskStatusDef[]): boolean {
  const def = statuses.find((s) => s.key === key);
  if (def?.isTerminal) return true;
  return LEGACY_TERMINAL_KEYS.has(key.toLowerCase());
}

export function isDone(task: Pick<Task, "status">, statuses: TaskStatusDef[]): boolean {
  return isTerminalStatus(task.status, statuses);
}

/** Default open status: o marcado `isDefaultOpen` ou primeiro não-terminal. */
export function findDefaultOpenStatus(statuses: TaskStatusDef[]): TaskStatusDef | undefined {
  return (
    statuses.find((s) => s.isDefaultOpen) ??
    statuses.find((s) => !isTerminalStatus(s.key, statuses)) ??
    statuses[0]
  );
}

/** Transição permitida — hoje aberta; ganchos para regras futuras. */
export function canTransition(_from: TaskStatusKey, _to: TaskStatusKey): boolean {
  return true;
}

/** Bucket temporal para um dueDate ISO (ou undefined). Timezone-safe. */
export function dueBucket(dueDateISO: string | undefined, now: Date = new Date()): DueBucket {
  if (!dueDateISO) return "none";
  const due = new Date(dueDateISO);
  if (Number.isNaN(due.getTime())) return "none";

  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const today = startOfDay(now);
  const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
  const dayAfterTomorrow = new Date(today.getTime() + 2 * 24 * 60 * 60 * 1000);
  const weekFromNow = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);

  if (due < today) return "overdue";
  if (due >= today && due < tomorrow) return "today";
  if (due >= tomorrow && due < dayAfterTomorrow) return "tomorrow";
  if (due < weekFromNow) return "week";
  return "later";
}

export function isOverdue(task: Pick<Task, "dueDate" | "status">, statuses: TaskStatusDef[], now: Date = new Date()): boolean {
  if (isDone(task, statuses)) return false;
  return dueBucket(task.dueDate, now) === "overdue";
}

/** Seções padrão para cada tipo — usado quando `activeSections` não vier setado. */
export function defaultSectionsFor(type: Task["type"]): Task["activeSections"] {
  switch (type) {
    case "checklist":
      return ["basic", "checklist"];
    case "content":
      return ["basic", "content"];
    case "document":
      return ["basic", "document"];
    case "simple":
    default:
      return ["basic"];
  }
}
