/**
 * Transactions Store — vanilla TS, indexers + subscribers.
 * Mesmo padrão de `tasksStore`/`workflowStore`.
 *
 * Onda 1: store paralelo. Bridges/realtime ligam na Onda 3.
 */

import type { Transacao } from "../../domain/types";

type Listener = () => void;

interface State {
  byId: Map<string, Transacao>;
  byItem: Map<string, Set<string>>;
  byStatus: Map<string, Set<string>>;
  /** YYYY-MM → set de ids (por dataVencimento). */
  byMonth: Map<string, Set<string>>;
  lastSeq: Map<string, string>;
}

const state: State = {
  byId: new Map(),
  byItem: new Map(),
  byStatus: new Map(),
  byMonth: new Map(),
  lastSeq: new Map(),
};

const listeners = new Set<Listener>();
let version = 0;

function notify() {
  version++;
  for (const fn of listeners) fn();
}

function idxAdd(map: Map<string, Set<string>>, key: string, id: string) {
  let s = map.get(key);
  if (!s) {
    s = new Set();
    map.set(key, s);
  }
  s.add(id);
}

function idxRemoveAll(map: Map<string, Set<string>>, id: string) {
  for (const s of map.values()) s.delete(id);
}

function monthKey(iso?: string): string {
  if (!iso) return "0000-00";
  return iso.slice(0, 7);
}

function reindex(t: Transacao) {
  idxRemoveAll(state.byItem, t.id);
  idxRemoveAll(state.byStatus, t.id);
  idxRemoveAll(state.byMonth, t.id);
  idxAdd(state.byItem, t.itemId, t.id);
  idxAdd(state.byStatus, t.status, t.id);
  idxAdd(state.byMonth, monthKey(t.dataVencimento), t.id);
}

export const transactionsStore = {
  hydrate(rows: Transacao[]) {
    state.byId.clear();
    state.byItem.clear();
    state.byStatus.clear();
    state.byMonth.clear();
    state.lastSeq.clear();
    for (const t of rows) {
      state.byId.set(t.id, t);
      reindex(t);
      state.lastSeq.set(t.id, t.atualizadoEm ?? t.criadoEm);
    }
    notify();
  },

  upsert(t: Transacao) {
    const seq = t.atualizadoEm ?? t.criadoEm;
    const prev = state.lastSeq.get(t.id);
    if (prev && seq && prev > seq) return;
    state.byId.set(t.id, t);
    reindex(t);
    state.lastSeq.set(t.id, seq);
    notify();
  },

  applyOptimisticPatch(id: string, patch: Partial<Transacao>): Transacao | undefined {
    const cur = state.byId.get(id);
    if (!cur) return undefined;
    const next = { ...cur, ...patch } as Transacao;
    state.byId.set(id, next);
    reindex(next);
    notify();
    return cur;
  },

  revertTo(snapshot: Transacao) {
    state.byId.set(snapshot.id, snapshot);
    reindex(snapshot);
    notify();
  },

  remove(id: string) {
    if (!state.byId.has(id)) return;
    state.byId.delete(id);
    idxRemoveAll(state.byItem, id);
    idxRemoveAll(state.byStatus, id);
    idxRemoveAll(state.byMonth, id);
    state.lastSeq.delete(id);
    notify();
  },

  clear() {
    state.byId.clear();
    state.byItem.clear();
    state.byStatus.clear();
    state.byMonth.clear();
    state.lastSeq.clear();
    notify();
  },

  // reads
  getAll(): Transacao[] {
    return Array.from(state.byId.values());
  },
  getById(id: string) {
    return state.byId.get(id);
  },
  getByItem(itemId: string): Transacao[] {
    const ids = state.byItem.get(itemId);
    if (!ids) return [];
    return Array.from(ids).map((id) => state.byId.get(id)!).filter(Boolean);
  },
  getByMonth(year: number, month: number): Transacao[] {
    const key = `${year.toString().padStart(4, "0")}-${month.toString().padStart(2, "0")}`;
    const ids = state.byMonth.get(key);
    if (!ids) return [];
    return Array.from(ids).map((id) => state.byId.get(id)!).filter(Boolean);
  },

  subscribe(l: Listener) {
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  },
  getSnapshot(): number {
    return version;
  },
  getVersion(): number {
    return version;
  },
};

export type TransactionsStore = typeof transactionsStore;
