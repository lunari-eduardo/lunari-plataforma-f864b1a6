import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { Task, TaskAttachment, ChecklistItem, TaskCaption } from '@/types/tasks';
import type { Json } from '@/integrations/supabase/types';

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
  };
}

// Helper to convert Task to DB row format
function taskToDbRow(task: Partial<Task>, userId: string): Record<string, unknown> {
  const row: Record<string, unknown> = {
    user_id: userId,
  };

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

  return row;
}

export function useSupabaseTasks() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTasks = useCallback(async () => {
    if (!user?.id) return;
    
    try {
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setTasks((data || []).map(row => dbRowToTask(row as unknown as Record<string, unknown>)));
    } catch (error) {
      console.error('Error fetching tasks:', error);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  // Realtime subscription
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel('tasks_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tasks',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          fetchTasks();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, fetchTasks]);

  const addTask = useCallback(async (input: Omit<Task, 'id' | 'createdAt'>): Promise<Task | null> => {
    if (!user?.id) return null;

    try {
      const dbRow = taskToDbRow(input, user.id) as {
        user_id: string;
        title?: string;
        [key: string]: unknown;
      };
      
      const { data, error } = await supabase
        .from('tasks')
        .insert(dbRow as { user_id: string; title: string })
        .select()
        .single();

      if (error) throw error;

      const newTask = dbRowToTask(data as unknown as Record<string, unknown>);
      setTasks(prev => [newTask, ...prev]);
      return newTask;
    } catch (error) {
      console.error('Error adding task:', error);
      return null;
    }
  }, [user?.id]);

  const updateTask = useCallback(async (id: string, updates: Partial<Task>) => {
    if (!user?.id) return;

    try {
      const dbRow: Record<string, unknown> = {};
      
      // Only add fields that are being updated (exclude user_id)
      const tempRow = taskToDbRow(updates, user.id);
      Object.keys(tempRow).forEach(key => {
        if (key !== 'user_id') {
          dbRow[key] = tempRow[key];
        }
      });

      // Handle completedAt for status changes
      if (updates.status) {
        const currentTask = tasks.find(t => t.id === id);
        if (updates.status === 'done' && currentTask?.status !== 'done') {
          dbRow.completed_at = new Date().toISOString();
        } else if (updates.status !== 'done' && currentTask?.status === 'done') {
          dbRow.completed_at = null;
        }
      }

      const { error } = await supabase
        .from('tasks')
        .update(dbRow)
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) throw error;

      setTasks(prev => prev.map(t => {
        if (t.id !== id) return t;
        const next: Task = { ...t, ...updates };
        if (updates.status && updates.status !== t.status) {
          if (updates.status === 'done') {
            next.completedAt = new Date().toISOString();
          } else if (t.status === 'done') {
            next.completedAt = undefined;
          }
        }
        return next;
      }));
    } catch (error) {
      console.error('Error updating task:', error);
    }
  }, [user?.id, tasks]);

  const deleteTask = useCallback(async (id: string) => {
    if (!user?.id) return;

    try {
      const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) throw error;

      setTasks(prev => prev.filter(t => t.id !== id));
    } catch (error) {
      console.error('Error deleting task:', error);
    }
  }, [user?.id]);

  return {
    tasks,
    loading,
    addTask,
    updateTask,
    deleteTask,
    refetch: fetchTasks,
  };
}
