import { useCallback, useEffect, useState } from 'react';
import { storage, STORAGE_KEYS } from '@/utils/localStorage';

export interface TaskTagDef {
  id: string;
  name: string;
  color?: string;
}

type Direction = 'up' | 'down';

export function useTaskTags() {
  const [tick, setTick] = useState(0);
  const [tags, setTags] = useState<TaskTagDef[]>(() => storage.load<TaskTagDef[]>(STORAGE_KEYS.TASK_TAGS, []));

  // Reload tags when tick changes
  useEffect(() => {
    setTags(storage.load<TaskTagDef[]>(STORAGE_KEYS.TASK_TAGS, []));
  }, [tick]);

  const save = useCallback((newTags: TaskTagDef[]) => {
    storage.save(STORAGE_KEYS.TASK_TAGS, newTags);
    setTags(newTags);
    setTick(v => v + 1);
    window.dispatchEvent(new Event('taskTagsUpdated'));
  }, []);

  const addTag = useCallback((name: string) => {
    const id = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const newTags = [...tags, { id, name: name.trim() }];
    save(newTags);
  }, [tags, save]);

  const updateTag = useCallback((id: string, patch: Partial<TaskTagDef>) => {
    const newTags = tags.map(t => (t.id === id ? { ...t, ...patch } : t));
    save(newTags);
  }, [tags, save]);

  const removeTag = useCallback((id: string) => {
    const newTags = tags.filter(t => t.id !== id);
    save(newTags);
  }, [tags, save]);

  const moveTag = useCallback((id: string, dir: Direction) => {
    const idx = tags.findIndex(t => t.id === id);
    if (idx < 0) return;
    const next = [...tags];
    const swapWith = dir === 'up' ? idx - 1 : idx + 1;
    if (swapWith < 0 || swapWith >= next.length) return;
    [next[idx], next[swapWith]] = [next[swapWith], next[idx]];
    save(next);
  }, [tags, save]);

  // Listen for external updates
  useEffect(() => {
    const onChange = () => setTick(v => v + 1);
    window.addEventListener('storage', onChange);
    window.addEventListener('taskTagsUpdated', onChange);
    return () => {
      window.removeEventListener('storage', onChange);
      window.removeEventListener('taskTagsUpdated', onChange);
    };
  }, []);

  return { tags, addTag, updateTag, removeTag, moveTag };
}
