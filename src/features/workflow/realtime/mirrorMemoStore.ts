/**
 * Memo singleton para anti-eco da bidirecionalidade Produto ↔ Tarefa.
 *
 * Chave composta: `${sessionId}:${produtoId}` — permite N produtos por sessão
 * coexistirem sem sobrescrever entries um do outro (bug histórico).
 *
 * Janela ampliada para 8 s (cobre p99 de latência do realtime Supabase).
 */

interface Entry {
  etapasHash: string;
  /** Título esperado da tarefa-espelho após a convergência. Permite que o
   *  reconciliador aceite tarefas cujo título já bate com a intenção
   *  memorizada mesmo dentro da janela anti-eco. */
  expectedTitle?: string;
  at: number;
}

const WINDOW_MS = 8000;
const MAX_ENTRIES = 500;
const state = new Map<string, Entry>();

const keyOf = (sessionId: string, produtoId: string) => `${sessionId}:${produtoId}`;

function evictIfNeeded() {
  if (state.size <= MAX_ENTRIES) return;
  const entries = Array.from(state.entries()).sort((a, b) => a[1].at - b[1].at);
  const toRemove = Math.ceil(MAX_ENTRIES * 0.1);
  for (let i = 0; i < toRemove; i++) state.delete(entries[i][0]);
}

export const mirrorMemoStore = {
  memorize(sessionId: string, produtoId: string, etapasHash: string, expectedTitle?: string) {
    state.set(keyOf(sessionId, produtoId), { etapasHash, expectedTitle, at: Date.now() });
    evictIfNeeded();
  },
  matches(sessionId: string, produtoId: string, etapasHash: string): boolean {
    const entry = state.get(keyOf(sessionId, produtoId));
    if (!entry) return false;
    if (entry.etapasHash !== etapasHash) return false;
    if (Date.now() - entry.at > WINDOW_MS) {
      state.delete(keyOf(sessionId, produtoId));
      return false;
    }
    return true;
  },
  /** Retorna a entrada memo se ainda estiver dentro da janela; caso contrário, remove e retorna null. */
  peek(sessionId: string, produtoId: string): Entry | null {
    const entry = state.get(keyOf(sessionId, produtoId));
    if (!entry) return null;
    if (Date.now() - entry.at > WINDOW_MS) {
      state.delete(keyOf(sessionId, produtoId));
      return null;
    }
    return entry;
  },
  /** Retorna true se existe qualquer memo recente para (sessão, produto), independente do hash. */
  hasRecent(sessionId: string, produtoId: string): boolean {
    const entry = state.get(keyOf(sessionId, produtoId));
    if (!entry) return false;
    if (Date.now() - entry.at > WINDOW_MS) {
      state.delete(keyOf(sessionId, produtoId));
      return false;
    }
    return true;
  },
  clear(sessionId?: string, produtoId?: string) {
    if (sessionId && produtoId) {
      state.delete(keyOf(sessionId, produtoId));
    } else if (sessionId) {
      for (const key of state.keys()) {
        if (key.startsWith(`${sessionId}:`)) state.delete(key);
      }
    } else {
      state.clear();
    }
  },
};
