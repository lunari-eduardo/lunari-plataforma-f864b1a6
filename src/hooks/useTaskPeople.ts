import { useCallback, useEffect, useState } from 'react';
import { storage, STORAGE_KEYS } from '@/utils/localStorage';

export interface TaskPerson {
  id: string;
  name: string;
  color?: string;
}

type Direction = 'up' | 'down';

export function useTaskPeople() {
  const [tick, setTick] = useState(0);
  const [people, setPeople] = useState<TaskPerson[]>(() => storage.load<TaskPerson[]>(STORAGE_KEYS.TASK_PEOPLE, []));

  // Reload people when tick changes
  useEffect(() => {
    setPeople(storage.load<TaskPerson[]>(STORAGE_KEYS.TASK_PEOPLE, []));
  }, [tick]);

  const save = useCallback((newPeople: TaskPerson[]) => {
    storage.save(STORAGE_KEYS.TASK_PEOPLE, newPeople);
    setPeople(newPeople);
    setTick(v => v + 1);
    window.dispatchEvent(new Event('taskPeopleUpdated'));
  }, []);

  const addPerson = useCallback((name: string) => {
    const id = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const newPeople = [...people, { id, name: name.trim() }];
    save(newPeople);
  }, [people, save]);

  const updatePerson = useCallback((id: string, patch: Partial<TaskPerson>) => {
    const newPeople = people.map(p => (p.id === id ? { ...p, ...patch } : p));
    save(newPeople);
  }, [people, save]);

  const removePerson = useCallback((id: string) => {
    const newPeople = people.filter(p => p.id !== id);
    save(newPeople);
  }, [people, save]);

  const movePerson = useCallback((id: string, dir: Direction) => {
    const idx = people.findIndex(p => p.id === id);
    if (idx < 0) return;
    const next = [...people];
    const swapWith = dir === 'up' ? idx - 1 : idx + 1;
    if (swapWith < 0 || swapWith >= next.length) return;
    [next[idx], next[swapWith]] = [next[swapWith], next[idx]];
    save(next);
  }, [people, save]);

  // Listen for external updates
  useEffect(() => {
    const onChange = () => setTick(v => v + 1);
    window.addEventListener('storage', onChange);
    window.addEventListener('taskPeopleUpdated', onChange);
    return () => {
      window.removeEventListener('storage', onChange);
      window.removeEventListener('taskPeopleUpdated', onChange);
    };
  }, []);

  return { people, addPerson, updatePerson, removePerson, movePerson };
}
