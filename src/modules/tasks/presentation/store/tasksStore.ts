/**
 * Tasks Store — vanilla TS, indexers + subscribers, à la `workflowStore`.
 *
 * Onda 1: store paralelo. Nenhum consumidor em produção escreve nele ainda.
 * Onda 2+ ligará o canal realtime único como única fonte de upsert.
 */

import type { Task, TaskStatusKey } from "../../domain/types";

type Listener = () => void;

interface TasksStoreState {
  byId: Map<string, Task>;
  byStatus: Map<TaskStatusKey, Set<string>>;
  byAssignee: Map<string, Set<string>>;
  /** Anti-eco: último createdAt/updatedAt observado por id (string ISO). */
  lastSeq: Map<string, string>;
}

function createEmptyState(): TasksStoreState {
  return {
    byId: new Map(),
    byStatus: new Map(),
    byAssignee: new Map(),
    lastSeq: new Map(),
  };
}

const state: TasksStoreState = createEmptyState();
const listeners = new Set<Listener>();
let version = 0;
const snapshotRef = { v: version };

function notify() {
  version++;
  snapshotRef.v = version;
  for (const fn of listeners) fn();
}

function indexAdd(map: Map<string, Set<string>>, key: string, id: string) {
  let set = map.get(key);
  if (!set) {
    set = new Set();
    map.set(key, set);
  }
  set.add(id);
}

function indexRemoveAll(map: Map<string, Set<string>>, id: string) {
  for (const set of map.values()) set.delete(id);
}

function indexTask(task: Task) {
  indexRemoveAll(state.byStatus, task.id);
  indexRemoveAll(state.byAssignee, task.id);
  indexAdd(state.byStatus, task.status, task.id);
  const assignee = task.assigneeId ?? task.assigneeName ?? "__unassigned__";
  indexAdd(state.byAssignee, assignee, task.id);
}

export const tasksStore = {
  /** Substitui completamente a coleção. */
  hydrate(tasks: Task[]) {
    state.byId.clear();
    state.byStatus.clear();
    state.byAssignee.clear();
    state.lastSeq.clear();
    for (const t of tasks) {
      state.byId.set(t.id, t);
      indexTask(t);
      state.lastSeq.set(t.id, t.createdAt);
    }
    notify();
  },

  upsert(task: Task) {
    const prevSeq = state.lastSeq.get(task.id);
    // Anti-eco simples — descarta updates "antigos".
    if (prevSeq && task.createdAt && prevSeq > task.createdAt) return;
    state.byId.set(task.id, task);
    indexTask(task);
    state.lastSeq.set(task.id, task.createdAt);
    notify();
  },

  remove(id: string) {
    if (!state.byId.has(id)) return;
    state.byId.delete(id);
    indexRemoveAll(state.byStatus, id);
    indexRemoveAll(state.byAssignee, id);
    state.lastSeq.delete(id);
    notify();
  },

  clear() {
    state.byId.clear();
    state.byStatus.clear();
    state.byAssignee.clear();
    state.lastSeq.clear();
    notify();
  },

  // ===== reads =====
  getAll(): Task[] {
    return Array.from(state.byId.values());
  },
  getById(id: string): Task | undefined {
    return state.byId.get(id);
  },
  getByStatus(key: TaskStatusKey): Task[] {
    const ids = state.byStatus.get(key);
    if (!ids) return [];
    const out: Task[] = [];
    for (const id of ids) {
      const t = state.byId.get(id);
      if (t) out.push(t);
    }
    return out;
  },
  getByAssignee(key: string): Task[] {
    const ids = state.byAssignee.get(key);
    if (!ids) return [];
    const out: Task[] = [];
    for (const id of ids) {
      const t = state.byId.get(id);
      if (t) out.push(t);
    }
    return out;
  },

  // ===== subscription (useSyncExternalStore) =====
  subscribe(listener: Listener) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  getSnapshot(): { v: number } {
    return snapshotRef;
  },
  /** Versão monotônica — útil para debugging. */
  getVersion(): number {
    return version;
  },
};

export type TasksStore = typeof tasksStore;
