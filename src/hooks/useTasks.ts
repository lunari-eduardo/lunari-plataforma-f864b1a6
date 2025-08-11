import { useEffect, useState, useCallback } from 'react';
import { storage, STORAGE_KEYS } from '@/utils/localStorage';
import type { Task } from '@/types/tasks';

export function useTasks() {
  const [tasks, setTasks] = useState<Task[]>(() => {
    return storage.load<Task[]>(STORAGE_KEYS.TASKS, []);
  });

  useEffect(() => {
    storage.save(STORAGE_KEYS.TASKS, tasks);
    window.dispatchEvent(new CustomEvent('tasks:changed'));
  }, [tasks]);

  // Listen for external changes (other tabs or other parts of the app)
  useEffect(() => {
    const reload = () => {
      const latest = storage.load<Task[]>(STORAGE_KEYS.TASKS, []);
      setTasks((prev) => {
        try {
          if (JSON.stringify(prev) === JSON.stringify(latest)) return prev;
        } catch {}
        return latest;
      });
    };

    const onStorage = (e: StorageEvent) => {
      if (!e.key || e.key === STORAGE_KEYS.TASKS) reload();
    };

    window.addEventListener('storage', onStorage);
    window.addEventListener('tasks:changed', reload as EventListener);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('tasks:changed', reload as EventListener);
    };
  }, []);

  const addTask = useCallback((input: Omit<Task, 'id' | 'createdAt'>) => {
    const task: Task = {
      ...input,
      id: `task_${Date.now()}`,
      createdAt: new Date().toISOString(),
    };
    setTasks(prev => [task, ...prev]);
    return task;
  }, []);

  const updateTask = useCallback((id: string, updates: Partial<Task>) => {
    setTasks(prev => prev.map(t => {
      if (t.id !== id) return t;
      const next: Task = { ...t, ...updates } as Task;
      if (updates.status && updates.status !== t.status) {
        if (updates.status === 'done') {
          next.completedAt = new Date().toISOString();
        } else if (t.status === 'done') {
          next.completedAt = undefined;
        }
      }
      return next;
    }));
  }, []);
  const deleteTask = useCallback((id: string) => {
    setTasks(prev => prev.filter(t => t.id !== id));
  }, []);

  return { tasks, addTask, updateTask, deleteTask };
}
