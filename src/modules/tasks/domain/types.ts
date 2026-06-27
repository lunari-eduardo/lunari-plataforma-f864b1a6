/**
 * Tipos canônicos do módulo Tasks.
 * Espelha (e amplia) `src/types/tasks.ts` para que `presentation/` e
 * `application/` consumam apenas daqui.
 *
 * Onda 1 — pura definição, sem efeitos.
 */

export type TaskStatusKey = string;
export type TaskPriority = "low" | "medium" | "high";
export type TaskType = "simple" | "content" | "checklist" | "document";
export type TaskSection = "basic" | "checklist" | "content" | "document";
export type TaskSource = "automation" | "manual" | "ai";

export interface ChecklistItem {
  id: string;
  text: string;
  completed: boolean;
  createdAt: string;
}

export interface TaskAttachment {
  id: string;
  name: string;
  type: "document" | "image" | "text";
  url?: string;
  content?: string;
  uploadedAt: string;
  size?: number;
  mimeType?: string;
}

export interface TaskCaption {
  id: string;
  title: string;
  content: string;
  hashtags?: string[];
  createdAt: string;
  platform?: "instagram" | "facebook" | "general";
  characterCount?: number;
}
export interface TaskTextBlock {
  id: string;
  title: string;
  content: string;
  order: number;
}


export interface Task {
  id: string;
  title: string;
  description?: string;
  status: TaskStatusKey;
  priority: TaskPriority;
  type: TaskType;
  source: TaskSource;
  createdAt: string;
  completedAt?: string;
  dueDate?: string;
  snoozeUntil?: string;
  lastNotifiedAt?: string;

  assigneeId?: string;
  assigneeName?: string;
  tags?: string[];

  relatedClienteId?: string;
  relatedSessionId?: string;
  relatedBudgetId?: string;

  activeSections?: TaskSection[];
  checked?: boolean;
  checklistItems?: ChecklistItem[];
  callToAction?: string;
  socialPlatforms?: string[];
  attachments?: TaskAttachment[];
  captions?: TaskCaption[];
  notes?: string;
  estimatedHours?: number;
}

export interface TaskStatusDef {
  key: TaskStatusKey;
  name: string;
  color?: string;
  order?: number;
  /** Marca status como "terminal" (substitui o hardcode `=== 'done'`). */
  isTerminal?: boolean;
  /** Status default para criação rápida. */
  isDefaultOpen?: boolean;
}

/** Buckets temporais usados em filtros e snapshots para a Lu. */
export type DueBucket = "overdue" | "today" | "tomorrow" | "week" | "later" | "none";

export interface TaskFiltersState {
  search: string;
  status: TaskStatusKey | "all";
  priority: TaskPriority | "all";
  assignee: string | "all";
  dateRange: "all" | "today" | "week" | "month" | "overdue";
}
