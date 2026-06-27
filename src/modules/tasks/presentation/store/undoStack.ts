/**
 * Undo Stack — pilha volátil em memória para desfazer até 3 ações
 * acidentais no Kanban de Tarefas (move, complete, reopen, delete).
 *
 * Não persiste em localStorage: undo é para acidentes imediatos.
 */

import type { Task } from '@/types/tasks';

export type UndoEntry =
  | { kind: 'move'; id: string; fromStatus: string; toStatus: string; at: number; label: string }
  | { kind: 'complete'; id: string; fromStatus: string; at: number; label: string }
  | { kind: 'reopen'; id: string; fromStatus: string; at: number; label: string }
  | { kind: 'delete'; snapshot: Task; at: number; label: string };

const MAX_ENTRIES = 3;
export const UNDO_TTL_MS = 30_000;

type Listener = () => void;

const state = {
  entries: [] as UndoEntry[],
};
const listeners = new Set<Listener>();
let version = 0;
const snapshotRef = { v: version };

function notify() {
  version++;
  snapshotRef.v = version;
  for (const fn of listeners) fn();
}

function prune() {
  const now = Date.now();
  const before = state.entries.length;
  state.entries = state.entries.filter((e) => now - e.at <= UNDO_TTL_MS);
  if (state.entries.length !== before) notify();
}

export const undoStack = {
  push(entry: UndoEntry) {
    state.entries = [entry, ...state.entries].slice(0, MAX_ENTRIES);
    notify();
  },
  pop(): UndoEntry | undefined {
    prune();
    const [head, ...rest] = state.entries;
    if (!head) return undefined;
    state.entries = rest;
    notify();
    return head;
  },
  peek(): UndoEntry | undefined {
    prune();
    return state.entries[0];
  },
  list(): UndoEntry[] {
    prune();
    return state.entries.slice();
  },
  size(): number {
    prune();
    return state.entries.length;
  },
  clear() {
    if (state.entries.length === 0) return;
    state.entries = [];
    notify();
  },
  subscribe(listener: Listener) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  getSnapshot(): { v: number } {
    return snapshotRef;
  },
};

export type UndoStack = typeof undoStack;
