/**
 * Implementação Supabase da `TasksRepo`.
 * Único ponto autorizado a tocar `supabase.from('tasks')` (junto do realtime channel).
 *
 * Mapeia colunas snake_case <-> camelCase via `mappers`.
 */

import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import type {
  ChecklistItem,
  Task,
  TaskAttachment,
  TaskCaption,
  TaskPriority,
  TaskSection,
  TaskSource,
  TaskTextBlock,
  TaskType,
} from "../../domain/types";
import type { ListTasksFilter, TasksRepo } from "../../ports/tasksRepo";

type TaskRow = Record<string, unknown>;

export function dbRowToTask(row: TaskRow): Task {
  return {
    id: row.id as string,
    title: row.title as string,
    description: (row.description as string | null) ?? undefined,
    status: ((row.status as string) || "todo") as Task["status"],
    priority: ((row.priority as string) || "medium") as TaskPriority,
    type: ((row.type as string) || "simple") as TaskType,
    source: ((row.source as string) || "manual") as TaskSource,
    createdAt: row.created_at as string,
    completedAt: (row.completed_at as string | null) ?? undefined,
    dueDate: (row.due_date as string | null) ?? undefined,
    snoozeUntil: (row.snooze_until as string | null) ?? undefined,
    lastNotifiedAt: (row.last_notified_at as string | null) ?? undefined,
    assigneeId: (row.assignee_id as string | null) ?? undefined,
    assigneeName: (row.assignee_name as string | null) ?? undefined,
    tags: (row.tags as string[] | null) ?? undefined,
    relatedClienteId: (row.related_cliente_id as string | null) ?? undefined,
    relatedSessionId: (row.related_session_id as string | null) ?? undefined,
    relatedBudgetId: (row.related_budget_id as string | null) ?? undefined,
    activeSections: (row.active_sections as TaskSection[] | null) ?? undefined,
    checked: (row.checked as boolean | null) ?? undefined,
    checklistItems: (row.checklist_items as ChecklistItem[] | null) ?? undefined,
    callToAction: (row.call_to_action as string | null) ?? undefined,
    socialPlatforms: (row.social_platforms as string[] | null) ?? undefined,
    attachments: (row.attachments as TaskAttachment[] | null) ?? undefined,
    captions: (row.captions as TaskCaption[] | null) ?? undefined,
    notes: (row.notes as string | null) ?? undefined,
    estimatedHours: (row.estimated_hours as number | null) ?? undefined,
    textBlocks: (row.text_blocks as TaskTextBlock[] | null) ?? undefined,
  };
}

function taskToDbRow(task: Partial<Task>, userId: string): TaskRow {
  const row: TaskRow = { user_id: userId };
  const set = <K extends keyof Task>(col: string, key: K, mapper?: (v: Task[K]) => unknown) => {
    if (task[key] !== undefined) row[col] = mapper ? mapper(task[key] as Task[K]) : task[key];
  };
  set("title", "title");
  set("description", "description");
  set("status", "status");
  set("priority", "priority");
  set("assignee_id", "assigneeId");
  set("assignee_name", "assigneeName");
  set("due_date", "dueDate");
  set("tags", "tags");
  set("related_cliente_id", "relatedClienteId");
  set("related_budget_id", "relatedBudgetId");
  set("related_session_id", "relatedSessionId");
  set("last_notified_at", "lastNotifiedAt");
  set("snooze_until", "snoozeUntil");
  set("source", "source");
  set("completed_at", "completedAt");
  set("type", "type");
  set("active_sections", "activeSections", (v) => v as unknown as Json);
  set("checked", "checked");
  set("checklist_items", "checklistItems", (v) => v as unknown as Json);
  set("call_to_action", "callToAction");
  set("social_platforms", "socialPlatforms");
  set("attachments", "attachments", (v) => v as unknown as Json);
  set("notes", "notes");
  set("estimated_hours", "estimatedHours");
  set("captions", "captions", (v) => v as unknown as Json);
  return row;
}

export const supabaseTasksRepo: TasksRepo = {
  async list({ userId, limit }: ListTasksFilter): Promise<Task[]> {
    let q = supabase
      .from("tasks")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (limit) q = q.limit(limit);
    const { data, error } = await q;
    if (error) throw error;
    return (data ?? []).map((row) => dbRowToTask(row as unknown as TaskRow));
  },

  async getById(id, userId) {
    const { data, error } = await supabase
      .from("tasks")
      .select("*")
      .eq("id", id)
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw error;
    return data ? dbRowToTask(data as unknown as TaskRow) : null;
  },

  async create(input, userId) {
    const row = taskToDbRow(input, userId) as { user_id: string; title: string };
    const { data, error } = await supabase
      .from("tasks")
      .insert(row)
      .select()
      .single();
    if (error) throw error;
    return dbRowToTask(data as unknown as TaskRow);
  },

  async update(id, patch, userId) {
    const row = taskToDbRow(patch, userId);
    delete (row as { user_id?: string }).user_id;
    const { data, error } = await supabase
      .from("tasks")
      .update(row)
      .eq("id", id)
      .eq("user_id", userId)
      .select()
      .single();
    if (error) throw error;
    return dbRowToTask(data as unknown as TaskRow);
  },

  async remove(id, userId) {
    const { error } = await supabase
      .from("tasks")
      .delete()
      .eq("id", id)
      .eq("user_id", userId);
    if (error) throw error;
  },
};
