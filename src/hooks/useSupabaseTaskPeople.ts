import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface TaskPerson {
  id: string;
  name: string;
  color?: string;
}

export function useSupabaseTaskPeople() {
  const { user } = useAuth();
  const [people, setPeople] = useState<TaskPerson[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPeople = useCallback(async () => {
    if (!user?.id) return;
    
    try {
      const { data, error } = await supabase
        .from('task_people')
        .select('*')
        .eq('user_id', user.id)
        .order('sort_order', { ascending: true });

      if (error) throw error;

      setPeople(data?.map(p => ({
        id: p.id,
        name: p.name,
        color: p.color || undefined,
      })) || []);
    } catch (error) {
      console.error('Error fetching task people:', error);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchPeople();
  }, [fetchPeople]);

  // Realtime subscription
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel('task_people_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'task_people',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          fetchPeople();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, fetchPeople]);

  const addPerson = useCallback(async (name: string): Promise<TaskPerson | null> => {
    if (!user?.id) return null;

    const maxOrder = people.length;

    try {
      const { data, error } = await supabase
        .from('task_people')
        .insert({
          user_id: user.id,
          name,
          sort_order: maxOrder,
        })
        .select()
        .single();

      if (error) throw error;

      const newPerson: TaskPerson = {
        id: data.id,
        name: data.name,
        color: data.color || undefined,
      };

      setPeople(prev => [...prev, newPerson]);
      return newPerson;
    } catch (error) {
      console.error('Error adding person:', error);
      return null;
    }
  }, [user?.id, people.length]);

  const updatePerson = useCallback(async (id: string, patch: Partial<TaskPerson>) => {
    if (!user?.id) return;

    try {
      const updateData: Record<string, unknown> = {};
      if (patch.name !== undefined) updateData.name = patch.name;
      if (patch.color !== undefined) updateData.color = patch.color;

      const { error } = await supabase
        .from('task_people')
        .update(updateData)
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) throw error;

      setPeople(prev => prev.map(p => p.id === id ? { ...p, ...patch } : p));
    } catch (error) {
      console.error('Error updating person:', error);
    }
  }, [user?.id]);

  const removePerson = useCallback(async (id: string) => {
    if (!user?.id) return;

    try {
      const { error } = await supabase
        .from('task_people')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) throw error;

      setPeople(prev => prev.filter(p => p.id !== id));
    } catch (error) {
      console.error('Error removing person:', error);
    }
  }, [user?.id]);

  const movePerson = useCallback(async (id: string, direction: 'up' | 'down') => {
    const idx = people.findIndex(p => p.id === id);
    if (idx < 0) return;
    
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= people.length) return;

    const newPeople = [...people];
    [newPeople[idx], newPeople[swapIdx]] = [newPeople[swapIdx], newPeople[idx]];
    setPeople(newPeople);

    // Update sort_order in database
    try {
      await Promise.all([
        supabase.from('task_people').update({ sort_order: swapIdx }).eq('id', id),
        supabase.from('task_people').update({ sort_order: idx }).eq('id', people[swapIdx].id),
      ]);
    } catch (error) {
      console.error('Error moving person:', error);
      fetchPeople(); // Revert on error
    }
  }, [people, fetchPeople]);

  return {
    people,
    loading,
    addPerson,
    updatePerson,
    removePerson,
    movePerson,
    refetch: fetchPeople,
  };
}
