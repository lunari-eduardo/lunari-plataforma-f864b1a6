import { useEffect, useState, useCallback } from 'react';
import { storage, STORAGE_KEYS } from '@/utils/localStorage';
import type { Task } from '@/types/tasks';

export function useTasks() {
  const [tasks, setTasks] = useState<Task[]>(() => {
    return storage.load<Task[]>(STORAGE_KEYS.TASKS, []);
  });

  useEffect(() => {
    storage.save(STORAGE_KEYS.TASKS, tasks);
  }, [tasks]);

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
    setTasks(prev => prev.map(t => (t.id === id ? { ...t, ...updates } : t)));
  }, []);

  const deleteTask = useCallback((id: string) => {
    setTasks(prev => prev.filter(t => t.id !== id));
  }, []);

  return { tasks, addTask, updateTask, deleteTask };
}
