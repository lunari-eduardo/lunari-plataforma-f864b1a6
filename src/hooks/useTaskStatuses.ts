import { useEffect, useMemo, useState, useCallback } from 'react';
import { storage, STORAGE_KEYS } from '@/utils/localStorage';

export interface TaskStatusDef {
  id: string;
  key: string; // valor salvo na tarefa
  name: string; // rótulo exibido
  order: number;
  isDone?: boolean; // identifica a coluna de concluídos
}

const DEFAULT_STATUSES: TaskStatusDef[] = [
  { id: 'todo', key: 'todo', name: 'A Fazer', order: 1 },
  { id: 'doing', key: 'doing', name: 'Em Andamento', order: 2 },
  { id: 'waiting', key: 'waiting', name: 'Aguardando', order: 3 },
  { id: 'done', key: 'done', name: 'Concluída', order: 4, isDone: true },
];

export const useTaskStatuses = () => {
  const [tick, setTick] = useState(0);

  const statuses = useMemo<TaskStatusDef[]>(() => {
    const saved = storage.load<TaskStatusDef[]>(STORAGE_KEYS.TASK_STATUSES, []);
    if (!saved || saved.length === 0) return DEFAULT_STATUSES;
    return [...saved].sort((a, b) => a.order - b.order);
  }, [tick]);

  const save = useCallback((items: TaskStatusDef[]) => {
    storage.save(STORAGE_KEYS.TASK_STATUSES, items);
    setTick((v) => v + 1);
    window.dispatchEvent(new Event('taskStatusesUpdated'));
  }, []);

  const addStatus = useCallback((name: string) => {
    const id = `status_${Date.now()}`;
    const next: TaskStatusDef = { id, key: id, name: name.trim() || 'Novo status', order: (statuses[statuses.length - 1]?.order ?? 0) + 1 };
    save([...statuses, next]);
    return next;
  }, [save, statuses]);

  const updateStatus = useCallback((id: string, patch: Partial<TaskStatusDef>) => {
    const next = statuses.map((s) => (s.id === id ? { ...s, ...patch } : s));
    // garantir apenas um isDone true
    if (patch.isDone) {
      const flagged = next.find((s) => s.id === id);
      if (flagged) {
        next.forEach((s) => { if (s.id !== id) s.isDone = false; });
      }
    }
    save(next);
  }, [save, statuses]);

  const removeStatus = useCallback((id: string) => {
    const toRemove = statuses.find((s) => s.id === id);
    if (!toRemove) return false;
    // impedir remoção se for o único concluído
    if (toRemove.isDone && !statuses.some((s) => s.id !== id && s.isDone)) {
      return false;
    }
    save(statuses.filter((s) => s.id !== id));
    return true;
  }, [save, statuses]);

  const moveStatus = useCallback((id: string, direction: 'up' | 'down') => {
    const idx = statuses.findIndex((s) => s.id === id);
    if (idx === -1) return;
    const swapWith = direction === 'up' ? idx - 1 : idx + 1;
    if (swapWith < 0 || swapWith >= statuses.length) return;
    const copy = [...statuses];
    const a = copy[idx];
    const b = copy[swapWith];
    // swap order
    const tmp = a.order; a.order = b.order; b.order = tmp;
    copy[idx] = b; copy[swapWith] = a;
    save(copy.sort((x, y) => x.order - y.order));
  }, [save, statuses]);

  const getDoneKey = useCallback(() => {
    return statuses.find((s) => s.isDone)?.key || 'done';
  }, [statuses]);

  const getDefaultOpenKey = useCallback(() => {
    return (statuses.find((s) => !s.isDone)?.key) || statuses[0]?.key || 'todo';
  }, [statuses]);

  // Força atualização quando localStorage externo alterar
  useEffect(() => {
    const onChange = () => setTick((v) => v + 1);
    window.addEventListener('storage', onChange);
    window.addEventListener('taskStatusesUpdated', onChange);
    return () => {
      window.removeEventListener('storage', onChange);
      window.removeEventListener('taskStatusesUpdated', onChange);
    };
  }, []);

  return {
    statuses,
    addStatus,
    updateStatus,
    removeStatus,
    moveStatus,
    getDoneKey,
    getDefaultOpenKey,
  };
};
