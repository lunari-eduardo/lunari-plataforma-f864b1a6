import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface TaskStatusDef {
  id: string;
  key: string;
  name: string;
  order: number;
  isDone?: boolean;
  color?: string;
}

const DEFAULT_STATUSES: Omit<TaskStatusDef, 'id'>[] = [
  { key: 'todo', name: 'A Fazer', order: 0, isDone: false, color: '#6b7280' },
  { key: 'in_progress', name: 'Em Andamento', order: 1, isDone: false, color: '#3b82f6' },
  { key: 'waiting', name: 'Aguardando', order: 2, isDone: false, color: '#f59e0b' },
  { key: 'done', name: 'Concluída', order: 3, isDone: true, color: '#22c55e' },
];

export function useSupabaseTaskStatuses() {
  const { user } = useAuth();
  const [statuses, setStatuses] = useState<TaskStatusDef[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchStatuses = useCallback(async () => {
    if (!user?.id) return;
    
    try {
      const { data, error } = await supabase
        .from('task_statuses')
        .select('*')
        .eq('user_id', user.id)
        .order('sort_order', { ascending: true });

      if (error) throw error;

      if (data && data.length > 0) {
        setStatuses(data.map(s => ({
          id: s.id,
          key: s.key,
          name: s.name,
          order: s.sort_order,
          isDone: s.is_done || false,
          color: s.color || '#6b7280',
        })));
      } else {
        // Seed default statuses
        await seedDefaultStatuses();
      }
    } catch (error) {
      console.error('Error fetching task statuses:', error);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  const seedDefaultStatuses = async () => {
    if (!user?.id) return;

    try {
      const toInsert = DEFAULT_STATUSES.map(s => ({
        user_id: user.id,
        key: s.key,
        name: s.name,
        sort_order: s.order,
        is_done: s.isDone || false,
        color: s.color || '#6b7280',
      }));

      const { data, error } = await supabase
        .from('task_statuses')
        .insert(toInsert)
        .select();

      if (error) throw error;

      if (data) {
        setStatuses(data.map(s => ({
          id: s.id,
          key: s.key,
          name: s.name,
          order: s.sort_order,
          isDone: s.is_done || false,
          color: s.color || '#6b7280',
        })));
      }
    } catch (error) {
      console.error('Error seeding default statuses:', error);
    }
  };

  useEffect(() => {
    fetchStatuses();
  }, [fetchStatuses]);

  // Realtime subscription
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel('task_statuses_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'task_statuses',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          fetchStatuses();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, fetchStatuses]);

  const addStatus = useCallback(async (name: string): Promise<TaskStatusDef | null> => {
    if (!user?.id) return null;

    const maxOrder = statuses.length > 0 ? Math.max(...statuses.map(s => s.order)) : -1;
    const newKey = `status_${Date.now()}`;

    try {
      const { data, error } = await supabase
        .from('task_statuses')
        .insert({
          user_id: user.id,
          key: newKey,
          name,
          sort_order: maxOrder + 1,
          is_done: false,
          color: '#6b7280',
        })
        .select()
        .single();

      if (error) throw error;

      const newStatus: TaskStatusDef = {
        id: data.id,
        key: data.key,
        name: data.name,
        order: data.sort_order,
        isDone: data.is_done || false,
        color: data.color || '#6b7280',
      };

      setStatuses(prev => [...prev, newStatus]);
      return newStatus;
    } catch (error) {
      console.error('Error adding status:', error);
      return null;
    }
  }, [user?.id, statuses]);

  const updateStatus = useCallback(async (id: string, patch: Partial<TaskStatusDef>) => {
    if (!user?.id) return;

    try {
      const updateData: Record<string, unknown> = {};
      if (patch.name !== undefined) updateData.name = patch.name;
      if (patch.color !== undefined) updateData.color = patch.color;
      if (patch.isDone !== undefined) updateData.is_done = patch.isDone;
      if (patch.order !== undefined) updateData.sort_order = patch.order;

      const { error } = await supabase
        .from('task_statuses')
        .update(updateData)
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) throw error;

      setStatuses(prev => prev.map(s => s.id === id ? { ...s, ...patch } : s));
    } catch (error) {
      console.error('Error updating status:', error);
    }
  }, [user?.id]);

  const removeStatus = useCallback(async (id: string): Promise<boolean> => {
    if (!user?.id) return false;

    const status = statuses.find(s => s.id === id);
    if (status?.isDone) {
      const doneCount = statuses.filter(s => s.isDone).length;
      if (doneCount <= 1) {
        console.warn('Cannot remove the last done status');
        return false;
      }
    }

    try {
      const { error } = await supabase
        .from('task_statuses')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) throw error;

      setStatuses(prev => prev.filter(s => s.id !== id));
      return true;
    } catch (error) {
      console.error('Error removing status:', error);
      return false;
    }
  }, [user?.id, statuses]);

  const moveStatus = useCallback(async (id: string, direction: 'up' | 'down') => {
    const idx = statuses.findIndex(s => s.id === id);
    if (idx < 0) return;
    
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= statuses.length) return;

    const newStatuses = [...statuses];
    const currentOrder = newStatuses[idx].order;
    const swapOrder = newStatuses[swapIdx].order;

    // Swap orders
    newStatuses[idx] = { ...newStatuses[idx], order: swapOrder };
    newStatuses[swapIdx] = { ...newStatuses[swapIdx], order: currentOrder };
    
    // Sort by order
    newStatuses.sort((a, b) => a.order - b.order);
    setStatuses(newStatuses);

    // Update in database
    try {
      await Promise.all([
        supabase.from('task_statuses').update({ sort_order: swapOrder }).eq('id', id),
        supabase.from('task_statuses').update({ sort_order: currentOrder }).eq('id', statuses[swapIdx].id),
      ]);
    } catch (error) {
      console.error('Error moving status:', error);
      fetchStatuses(); // Revert on error
    }
  }, [statuses, fetchStatuses]);

  const getDoneKey = useCallback((): string => {
    const done = statuses.find(s => s.isDone);
    return done?.key || 'done';
  }, [statuses]);

  const getDefaultOpenKey = useCallback((): string => {
    const open = statuses.find(s => !s.isDone);
    return open?.key || 'todo';
  }, [statuses]);

  return {
    statuses,
    loading,
    addStatus,
    updateStatus,
    removeStatus,
    moveStatus,
    getDoneKey,
    getDefaultOpenKey,
    refetch: fetchStatuses,
  };
}
