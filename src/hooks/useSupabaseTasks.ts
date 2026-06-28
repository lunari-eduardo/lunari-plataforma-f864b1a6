/**
 * useSupabaseTasks — facade legada.
 *
 * Após a Onda de unificação de realtime, este hook NÃO abre mais canal próprio
 * nem mantém estado local de lista. Ele:
 *  - Lê `tasks` ao vivo do `tasksStore` (alimentado pelo único canal Realtime
 *    em `TasksRealtimeBridge`).
 *  - Mantém as mutações antigas (Supabase direto) por compatibilidade com
 *    callsites que ainda não migraram para capabilities. As mutações também
 *    aplicam patch otimista no store para refletir antes do round-trip.
 *
 * Callsites migrarão para `useTasks()` + capabilities em uma onda futura.
 */

import { useCallback, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { Task, TaskAttachment, ChecklistItem, TaskCaption } from '@/types/tasks';
import type { Json } from '@/integrations/supabase/types';
import { useTasks } from '@/modules/tasks/presentation/hooks/useTasks';
import { tasksStore } from '@/modules/tasks/presentation/store/tasksStore';
import { taskStatusesStore } from '@/modules/tasks/presentation/store/taskStatusesStore';

// Helper to convert DB row to Task type
function dbRowToTask(row: Record<string, unknown>): Task {
  return {
    id: row.id as string,
    title: row.title as string,
    description: row.description as string | undefined,
    status: row.status as string || 'todo',
    priority: (row.priority as 'low' | 'medium' | 'high') || 'medium',
    assigneeId: row.assignee_id as string | undefined,
    assigneeName: row.assignee_name as string | undefined,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string | undefined,
    dueDate: row.due_date as string | undefined,
    tags: row.tags as string[] | undefined,
    relatedClienteId: row.related_cliente_id as string | undefined,
    relatedBudgetId: row.related_budget_id as string | undefined,
    relatedSessionId: row.related_session_id as string | undefined,
    lastNotifiedAt: row.last_notified_at as string | undefined,
    snoozeUntil: row.snooze_until as string | undefined,
    source: (row.source as 'automation' | 'manual') || 'manual',
    completedAt: row.completed_at as string | undefined,
    type: (row.type as Task['type']) || 'simple',
    activeSections: row.active_sections as Task['activeSections'] | undefined,
    checked: row.checked as boolean | undefined,
    checklistItems: row.checklist_items as ChecklistItem[] | undefined,
    callToAction: row.call_to_action as string | undefined,
    socialPlatforms: row.social_platforms as string[] | undefined,
    attachments: row.attachments as TaskAttachment[] | undefined,
    notes: row.notes as string | undefined,
    estimatedHours: row.estimated_hours as number | undefined,
    captions: row.captions as TaskCaption[] | undefined,
    textBlocks: row.text_blocks as Task['textBlocks'] | undefined,
  };
}

// Helper to convert Task to DB row format
function taskToDbRow(task: Partial<Task>, userId: string): Record<string, unknown> {
  const row: Record<string, unknown> = { user_id: userId };

  if (task.title !== undefined) row.title = task.title;
  if (task.description !== undefined) row.description = task.description;
  if (task.status !== undefined) row.status = task.status;
  if (task.priority !== undefined) row.priority = task.priority;
  if (task.assigneeId !== undefined) row.assignee_id = task.assigneeId;
  if (task.assigneeName !== undefined) row.assignee_name = task.assigneeName;
  if (task.dueDate !== undefined) row.due_date = task.dueDate;
  if (task.tags !== undefined) row.tags = task.tags;
  if (task.relatedClienteId !== undefined) row.related_cliente_id = task.relatedClienteId;
  if (task.relatedBudgetId !== undefined) row.related_budget_id = task.relatedBudgetId;
  if (task.relatedSessionId !== undefined) row.related_session_id = task.relatedSessionId;
  if (task.lastNotifiedAt !== undefined) row.last_notified_at = task.lastNotifiedAt;
  if (task.snoozeUntil !== undefined) row.snooze_until = task.snoozeUntil;
  if (task.source !== undefined) row.source = task.source;
  if (task.completedAt !== undefined) row.completed_at = task.completedAt;
  if (task.type !== undefined) row.type = task.type;
  if (task.activeSections !== undefined) row.active_sections = task.activeSections as unknown as Json;
  if (task.checked !== undefined) row.checked = task.checked;
  if (task.checklistItems !== undefined) row.checklist_items = task.checklistItems as unknown as Json;
  if (task.callToAction !== undefined) row.call_to_action = task.callToAction;
  if (task.socialPlatforms !== undefined) row.social_platforms = task.socialPlatforms;
  if (task.attachments !== undefined) row.attachments = task.attachments as unknown as Json;
  if (task.notes !== undefined) row.notes = task.notes;
  if (task.estimatedHours !== undefined) row.estimated_hours = task.estimatedHours;
  if (task.captions !== undefined) row.captions = task.captions as unknown as Json;
  if (task.textBlocks !== undefined) row.text_blocks = task.textBlocks as unknown as Json;

  return row;
}

export function useSupabaseTasks() {
  const { user } = useAuth();
  const tasks = useTasks();
  // `loading` agora reflete apenas o estado inicial de hidratação:
  // o store começa vazio até a `TasksRealtimeBridge` chamar `hydrate`.
  // Mantemos a flag para compatibilidade — fica `false` assim que houver
  // qualquer task no store ou após o primeiro tick.
  const [bootGuard] = useState(() => Date.now());
  const loading = tasks.length === 0 && Date.now() - bootGuard < 1500;

  const addTask = useCallback(
    async (input: Omit<Task, 'id' | 'createdAt'>): Promise<Task | null> => {
      if (!user?.id) return null;
      try {
        const dbRow = taskToDbRow(input, user.id) as { user_id: string; title: string };
        const { data, error } = await supabase
          .from('tasks')
          .insert(dbRow)
          .select()
          .single();
        if (error) throw error;
        const newTask = dbRowToTask(data as unknown as Record<string, unknown>);
        // Reflete imediatamente — realtime confirma depois (idempotente).
        tasksStore.upsert(newTask);
        return newTask;
      } catch (error) {
        console.error('Error adding task:', error);
        return null;
      }
    },
    [user?.id],
  );

  const updateTask = useCallback(
    async (id: string, updates: Partial<Task>) => {
      if (!user?.id) return;
      // Patch otimista — UI reflete antes do round-trip.
      const snapshot = tasksStore.applyOptimisticPatch(id, updates);
      try {
        const dbRow: Record<string, unknown> = {};
        const tempRow = taskToDbRow(updates, user.id);
        Object.keys(tempRow).forEach((key) => {
          if (key !== 'user_id') dbRow[key] = tempRow[key];
        });
        if (updates.status) {
          const current = snapshot;
          if (updates.status === 'done' && current?.status !== 'done') {
            dbRow.completed_at = new Date().toISOString();
          } else if (updates.status !== 'done' && current?.status === 'done') {
            dbRow.completed_at = null;
          }
        }
        const { data, error } = await supabase
          .from('tasks')
          .update(dbRow)
          .eq('id', id)
          .eq('user_id', user.id)
          .select()
          .single();
        if (error) throw error;
        if (data) tasksStore.upsert(dbRowToTask(data as unknown as Record<string, unknown>));
      } catch (error) {
        console.error('Error updating task:', error);
        if (snapshot) tasksStore.revertTo(snapshot);
      }
    },
    [user?.id],
  );

  const deleteTask = useCallback(
    async (id: string) => {
      if (!user?.id) return;
      const snapshot = tasksStore.getById(id);
      tasksStore.remove(id);
      try {
        const { error } = await supabase.from('tasks').delete().eq('id', id).eq('user_id', user.id);
        if (error) throw error;
      } catch (error) {
        console.error('Error deleting task:', error);
        if (snapshot) tasksStore.upsert(snapshot);
      }
    },
    [user?.id],
  );

  const refetch = useCallback(async () => {
    // Hidratação on-demand a partir do banco. A bridge faz isso automaticamente
    // no mount/reconnect; aqui só preservamos a assinatura por compatibilidade.
    if (!user?.id) return;
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    if (error) return;
    tasksStore.hydrate((data ?? []).map((r) => dbRowToTask(r as unknown as Record<string, unknown>)));
  }, [user?.id]);

  const applyOptimisticPatch = useCallback((id: string, patch: Partial<Task>) => {
    tasksStore.applyOptimisticPatch(id, patch);
  }, []);

  return {
    tasks,
    loading,
    addTask,
    updateTask,
    deleteTask,
    refetch,
    applyOptimisticPatch,
  };
}
