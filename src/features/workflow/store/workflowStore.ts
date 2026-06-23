/**
 * Workflow Store — vanilla TS, com indexers e subscribers.
 * Sem React aqui; o binding fino vive em `hooks/`.
 *
 * Onda 1: store paralelo. NENHUM consumidor ainda escreve nele em produção.
 * Onda 3+ migrará o realtime para alimentar este store como single source.
 */

import type { WorkflowSession } from "../domain/session";
import { getSessionYearMonth, monthBucketKey } from "../domain/session";

type Listener = () => void;

interface WorkflowStoreState {
  /** Lookup primário (uuid pk). */
  byId: Map<string, WorkflowSession>;
  /** Lookup pelo session_id texto (formato `workflow-*`). */
  bySessionId: Map<string, WorkflowSession>;
  /** Conjunto de ids por bucket "YYYY-MM". */
  byMonth: Map<string, Set<string>>;
  /** Último updated_at observado por id — anti-eco do realtime. */
  lastSeq: Map<string, string>;
}

function createEmptyState(): WorkflowStoreState {
  return {
    byId: new Map(),
    bySessionId: new Map(),
    byMonth: new Map(),
    lastSeq: new Map(),
  };
}

const state: WorkflowStoreState = createEmptyState();
const listeners = new Set<Listener>();
/** Versão monotônica para useSyncExternalStore (mudança = nova referência). */
let version = 0;
const snapshotRef = { v: version };

function notify() {
  version++;
  snapshotRef.v = version;
  for (const fn of listeners) fn();
}

function addToMonth(id: string, dateString?: string) {
  const ym = getSessionYearMonth(dateString);
  if (!ym) return;
  const key = monthBucketKey(ym.year, ym.month);
  let set = state.byMonth.get(key);
  if (!set) {
    set = new Set();
    state.byMonth.set(key, set);
  }
  set.add(id);
}

function removeFromAllMonths(id: string) {
  for (const set of state.byMonth.values()) {
    set.delete(id);
  }
}

/** Upsert idempotente; respeita sequence (ignora eventos antigos). */
function upsertOne(session: WorkflowSession): boolean {
  if (!session?.id) return false;
  const seq = session.updated_at ?? "";
  const lastSeen = state.lastSeq.get(session.id) ?? "";
  // Se updated_at é igual e já temos a sessão, ignora (anti-eco).
  if (lastSeen && seq && seq === lastSeen && state.byId.has(session.id)) return false;
  // Se vier mais antigo, ignora também.
  if (lastSeen && seq && seq < lastSeen) return false;

  const previous = state.byId.get(session.id);
  state.byId.set(session.id, session);
  if (session.session_id) state.bySessionId.set(session.session_id, session);
  if (seq) state.lastSeq.set(session.id, seq);

  // Reindex de mês se mudou data_sessao.
  if (!previous || previous.data_sessao !== session.data_sessao) {
    removeFromAllMonths(session.id);
    addToMonth(session.id, session.data_sessao);
  }
  return true;
}

function removeOne(id: string): boolean {
  const prev = state.byId.get(id);
  if (!prev) return false;
  state.byId.delete(id);
  if (prev.session_id) state.bySessionId.delete(prev.session_id);
  removeFromAllMonths(id);
  state.lastSeq.delete(id);
  return true;
}

export const workflowStore = {
  /** API leitura. */
  getById(id: string): WorkflowSession | undefined {
    return state.byId.get(id);
  },
  getBySessionId(sid: string): WorkflowSession | undefined {
    return state.bySessionId.get(sid);
  },
  getMonth(year: number, month: number): WorkflowSession[] {
    const set = state.byMonth.get(monthBucketKey(year, month));
    if (!set) return [];
    const out: WorkflowSession[] = [];
    for (const id of set) {
      const s = state.byId.get(id);
      if (s) out.push(s);
    }
    return out;
  },
  getAll(): WorkflowSession[] {
    return Array.from(state.byId.values());
  },
  getSnapshotVersion(): number {
    return snapshotRef.v;
  },
  /** API escrita. */
  upsert(session: WorkflowSession) {
    if (upsertOne(session)) notify();
  },
  upsertMany(sessions: WorkflowSession[]) {
    let changed = false;
    for (const s of sessions) {
      if (upsertOne(s)) changed = true;
    }
    if (changed) notify();
  },
  /** Substitui completamente o conteúdo de um bucket de mês. */
  setMonth(year: number, month: number, sessions: WorkflowSession[]) {
    const key = monthBucketKey(year, month);
    // Remove ids antigos do bucket que não estão na nova lista.
    const old = state.byMonth.get(key);
    const incoming = new Set(sessions.map((s) => s.id));
    if (old) {
      for (const id of old) {
        if (!incoming.has(id)) {
          // Só remove do bucket; mantém em byId pois pode estar referenciado por outro mês.
          old.delete(id);
        }
      }
    }
    for (const s of sessions) upsertOne(s);
    notify();
  },
  remove(id: string) {
    if (removeOne(id)) notify();
  },
  clear() {
    state.byId.clear();
    state.bySessionId.clear();
    state.byMonth.clear();
    state.lastSeq.clear();
    notify();
  },
  /** Subscribe pattern para useSyncExternalStore (Onda 5). */
  subscribe(listener: Listener): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};

export type WorkflowStore = typeof workflowStore;
