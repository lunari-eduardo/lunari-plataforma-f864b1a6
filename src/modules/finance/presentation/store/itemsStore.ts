/**
 * Items Store — subcategorias financeiras (`financial_items`).
 */

import type { ItemFinanceiro, Grupo } from "../../domain/types";
import { normalizeItemName } from "../../domain/rules";

type Listener = () => void;

interface State {
  byId: Map<string, ItemFinanceiro>;
  byGrupo: Map<Grupo, Set<string>>;
  /** `${grupo}::${lower(nome)}` → id, para idempotência. */
  byKey: Map<string, string>;
}

const state: State = {
  byId: new Map(),
  byGrupo: new Map(),
  byKey: new Map(),
};

const listeners = new Set<Listener>();
let version = 0;

function notify() {
  version++;
  for (const fn of listeners) fn();
}

function keyOf(item: { grupo: Grupo; nome: string }) {
  return `${item.grupo}::${normalizeItemName(item.nome)}`;
}

function reindex(item: ItemFinanceiro) {
  for (const s of state.byGrupo.values()) s.delete(item.id);
  let s = state.byGrupo.get(item.grupo);
  if (!s) {
    s = new Set();
    state.byGrupo.set(item.grupo, s);
  }
  s.add(item.id);
  state.byKey.set(keyOf(item), item.id);
}

export const itemsStore = {
  hydrate(rows: ItemFinanceiro[]) {
    state.byId.clear();
    state.byGrupo.clear();
    state.byKey.clear();
    for (const it of rows) {
      state.byId.set(it.id, it);
      reindex(it);
    }
    notify();
  },

  upsert(item: ItemFinanceiro) {
    state.byId.set(item.id, item);
    reindex(item);
    notify();
  },

  remove(id: string) {
    const cur = state.byId.get(id);
    if (!cur) return;
    state.byId.delete(id);
    for (const s of state.byGrupo.values()) s.delete(id);
    state.byKey.delete(keyOf(cur));
    notify();
  },

  clear() {
    state.byId.clear();
    state.byGrupo.clear();
    state.byKey.clear();
    notify();
  },

  // reads
  getAll(): ItemFinanceiro[] {
    return Array.from(state.byId.values()).filter((i) => i.ativo);
  },
  getById(id: string) {
    return state.byId.get(id);
  },
  getByGrupo(grupo: Grupo): ItemFinanceiro[] {
    const ids = state.byGrupo.get(grupo);
    if (!ids) return [];
    return Array.from(ids)
      .map((id) => state.byId.get(id)!)
      .filter((i) => i && i.ativo);
  },
  findByName(grupo: Grupo, nome: string): ItemFinanceiro | undefined {
    const id = state.byKey.get(keyOf({ grupo, nome }));
    return id ? state.byId.get(id) : undefined;
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

export type ItemsStore = typeof itemsStore;
