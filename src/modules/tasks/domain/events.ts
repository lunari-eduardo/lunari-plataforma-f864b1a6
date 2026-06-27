/**
 * Catálogo de eventos do módulo Tasks.
 * Publicados via shared event-bus; consumidos por Notificações, Workflow, Lu.
 */

import type { Task, TaskStatusKey } from "./types";

export type TasksEvent =
  | { type: "tasks.created"; task: Task; actor: "user" | "automation" | "ai" }
  | { type: "tasks.updated"; id: string; patch: Partial<Task>; actor: "user" | "automation" | "ai" }
  | { type: "tasks.moved"; id: string; from: TaskStatusKey; to: TaskStatusKey; actor: "user" | "automation" | "ai" }
  | { type: "tasks.completed"; id: string; at: string; actor: "user" | "automation" | "ai" }
  | { type: "tasks.reopened"; id: string; actor: "user" | "automation" | "ai" }
  | { type: "tasks.deleted"; id: string; actor: "user" | "automation" | "ai" }
  | { type: "tasks.snoozed"; id: string; until: string }
  | { type: "tasks.assigned"; id: string; assigneeId?: string; assigneeName?: string }
  | { type: "tasks.dueSoon"; id: string; in: "today" | "tomorrow" }
  | { type: "tasks.overdue"; id: string; since: string }
  | { type: "tasks.templateApplied"; templateId: string; createdIds: string[] };

export type TasksEventType = TasksEvent["type"];
