/**
 * Store singleton de Task Attachments.
 * Indexa por `taskId`. Snapshot version-bump (igual `tasksStore`).
 */
import { useSyncExternalStore } from "react";
import type { TaskAttachment } from "../../ports/attachmentsRepo";

type Listener = () => void;

interface State {
  byId: Map<string, TaskAttachment>;
  byTask: Map<string, Set<string>>;
  version: number;
}

const state: State = { byId: new Map(), byTask: new Map(), version: 0 };
const listeners = new Set<Listener>();

function bump() {
  state.version += 1;
  listeners.forEach((l) => l());
}

function indexAdd(a: TaskAttachment) {
  state.byId.set(a.id, a);
  if (!state.byTask.has(a.taskId)) state.byTask.set(a.taskId, new Set());
  state.byTask.get(a.taskId)!.add(a.id);
}

function indexRemove(id: string) {
  const prev = state.byId.get(id);
  if (!prev) return;
  state.byId.delete(id);
  state.byTask.get(prev.taskId)?.delete(id);
}

export const attachmentsStore = {
  subscribe(l: Listener) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
  getSnapshot() {
    return state.version;
  },
  hydrate(items: TaskAttachment[]) {
    state.byId.clear();
    state.byTask.clear();
    for (const a of items) indexAdd(a);
    bump();
  },
  upsert(a: TaskAttachment) {
    indexAdd(a);
    bump();
  },
  remove(id: string) {
    indexRemove(id);
    bump();
  },
  byTask(taskId: string): TaskAttachment[] {
    const ids = state.byTask.get(taskId);
    if (!ids || ids.size === 0) return [];
    const out: TaskAttachment[] = [];
    ids.forEach((id) => {
      const a = state.byId.get(id);
      if (a) out.push(a);
    });
    return out.sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));
  },
  countByTask(taskId: string): number {
    return state.byTask.get(taskId)?.size ?? 0;
  },
  reset() {
    state.byId.clear();
    state.byTask.clear();
    bump();
  },
};

export function useAttachmentsVersion(): number {
  return useSyncExternalStore(attachmentsStore.subscribe, attachmentsStore.getSnapshot);
}
