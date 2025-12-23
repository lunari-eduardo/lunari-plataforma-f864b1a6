import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface TaskTagDef {
  id: string;
  name: string;
  color?: string;
}

export function useSupabaseTaskTags() {
  const { user } = useAuth();
  const [tags, setTags] = useState<TaskTagDef[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTags = useCallback(async () => {
    if (!user?.id) return;
    
    try {
      const { data, error } = await supabase
        .from('task_tags')
        .select('*')
        .eq('user_id', user.id)
        .order('sort_order', { ascending: true });

      if (error) throw error;

      setTags(data?.map(t => ({
        id: t.id,
        name: t.name,
        color: t.color || undefined,
      })) || []);
    } catch (error) {
      console.error('Error fetching task tags:', error);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchTags();
  }, [fetchTags]);

  // Realtime subscription
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel('task_tags_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'task_tags',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          fetchTags();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, fetchTags]);

  const addTag = useCallback(async (name: string): Promise<TaskTagDef | null> => {
    if (!user?.id) return null;

    const maxOrder = tags.length;

    try {
      const { data, error } = await supabase
        .from('task_tags')
        .insert({
          user_id: user.id,
          name,
          sort_order: maxOrder,
        })
        .select()
        .single();

      if (error) throw error;

      const newTag: TaskTagDef = {
        id: data.id,
        name: data.name,
        color: data.color || undefined,
      };

      setTags(prev => [...prev, newTag]);
      return newTag;
    } catch (error) {
      console.error('Error adding tag:', error);
      return null;
    }
  }, [user?.id, tags.length]);

  const updateTag = useCallback(async (id: string, patch: Partial<TaskTagDef>) => {
    if (!user?.id) return;

    try {
      const updateData: Record<string, unknown> = {};
      if (patch.name !== undefined) updateData.name = patch.name;
      if (patch.color !== undefined) updateData.color = patch.color;

      const { error } = await supabase
        .from('task_tags')
        .update(updateData)
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) throw error;

      setTags(prev => prev.map(t => t.id === id ? { ...t, ...patch } : t));
    } catch (error) {
      console.error('Error updating tag:', error);
    }
  }, [user?.id]);

  const removeTag = useCallback(async (id: string) => {
    if (!user?.id) return;

    try {
      const { error } = await supabase
        .from('task_tags')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) throw error;

      setTags(prev => prev.filter(t => t.id !== id));
    } catch (error) {
      console.error('Error removing tag:', error);
    }
  }, [user?.id]);

  const moveTag = useCallback(async (id: string, direction: 'up' | 'down') => {
    const idx = tags.findIndex(t => t.id === id);
    if (idx < 0) return;
    
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= tags.length) return;

    const newTags = [...tags];
    [newTags[idx], newTags[swapIdx]] = [newTags[swapIdx], newTags[idx]];
    setTags(newTags);

    // Update sort_order in database
    try {
      await Promise.all([
        supabase.from('task_tags').update({ sort_order: swapIdx }).eq('id', id),
        supabase.from('task_tags').update({ sort_order: idx }).eq('id', tags[swapIdx].id),
      ]);
    } catch (error) {
      console.error('Error moving tag:', error);
      fetchTags(); // Revert on error
    }
  }, [tags, fetchTags]);

  return {
    tags,
    loading,
    addTag,
    updateTag,
    removeTag,
    moveTag,
    refetch: fetchTags,
  };
}
