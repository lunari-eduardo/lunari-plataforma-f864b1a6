import { useEffect, useState } from 'react';
import { storage, STORAGE_KEYS } from '@/utils/localStorage';

export interface TaskTagDef {
  id: string;
  name: string;
  color?: string;
}

type Direction = 'up' | 'down';

export function useTaskTags() {
  const [tags, setTags] = useState<TaskTagDef[]>(() => storage.load<TaskTagDef[]>(STORAGE_KEYS.TASK_TAGS, []));

  useEffect(() => {
    storage.save(STORAGE_KEYS.TASK_TAGS, tags);
  }, [tags]);

  const addTag = (name: string) => {
    const id = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    setTags(prev => [...prev, { id, name: name.trim() }]);
  };

  const updateTag = (id: string, patch: Partial<TaskTagDef>) => {
    setTags(prev => prev.map(t => (t.id === id ? { ...t, ...patch } : t)));
  };

  const removeTag = (id: string) => {
    setTags(prev => prev.filter(t => t.id !== id));
  };

  const moveTag = (id: string, dir: Direction) => {
    setTags(prev => {
      const idx = prev.findIndex(t => t.id === id);
      if (idx < 0) return prev;
      const next = [...prev];
      const swapWith = dir === 'up' ? idx - 1 : idx + 1;
      if (swapWith < 0 || swapWith >= next.length) return prev;
      [next[idx], next[swapWith]] = [next[swapWith], next[idx]];
      return next;
    });
  };

  return { tags, addTag, updateTag, removeTag, moveTag };
}
