import { useEffect, useState } from 'react';
import { storage, STORAGE_KEYS } from '@/utils/localStorage';

export interface TaskPerson {
  id: string;
  name: string;
  color?: string;
}

type Direction = 'up' | 'down';

export function useTaskPeople() {
  const [people, setPeople] = useState<TaskPerson[]>(() => storage.load<TaskPerson[]>(STORAGE_KEYS.TASK_PEOPLE, []));

  useEffect(() => {
    storage.save(STORAGE_KEYS.TASK_PEOPLE, people);
  }, [people]);

  const addPerson = (name: string) => {
    const id = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    setPeople(prev => [...prev, { id, name: name.trim() }]);
  };

  const updatePerson = (id: string, patch: Partial<TaskPerson>) => {
    setPeople(prev => prev.map(p => (p.id === id ? { ...p, ...patch } : p)));
  };

  const removePerson = (id: string) => {
    setPeople(prev => prev.filter(p => p.id !== id));
  };

  const movePerson = (id: string, dir: Direction) => {
    setPeople(prev => {
      const idx = prev.findIndex(p => p.id === id);
      if (idx < 0) return prev;
      const next = [...prev];
      const swapWith = dir === 'up' ? idx - 1 : idx + 1;
      if (swapWith < 0 || swapWith >= next.length) return prev;
      [next[idx], next[swapWith]] = [next[swapWith], next[idx]];
      return next;
    });
  };

  return { people, addPerson, updatePerson, removePerson, movePerson };
}
