/**
 * safeStorage — envoltório de localStorage/sessionStorage tolerante ao
 * modo privado do Safari (que lança QuotaExceededError em setItem) e a
 * navegadores com storage bloqueado. Sempre retorna string|null.
 */

type Backing = 'local' | 'session';

const memory: Record<Backing, Map<string, string>> = {
  local: new Map(),
  session: new Map(),
};

function backingStore(kind: Backing): Storage | null {
  try {
    return kind === 'local' ? window.localStorage : window.sessionStorage;
  } catch {
    return null;
  }
}

export const safeStorage = {
  get(key: string, kind: Backing = 'local'): string | null {
    try {
      const store = backingStore(kind);
      if (store) return store.getItem(key);
    } catch {
      /* Safari private mode / disabled */
    }
    return memory[kind].get(key) ?? null;
  },

  set(key: string, value: string, kind: Backing = 'local'): void {
    memory[kind].set(key, value);
    try {
      backingStore(kind)?.setItem(key, value);
    } catch {
      /* silenciar QuotaExceededError */
    }
  },

  remove(key: string, kind: Backing = 'local'): void {
    memory[kind].delete(key);
    try {
      backingStore(kind)?.removeItem(key);
    } catch {
      /* noop */
    }
  },

  json<T>(key: string, fallback: T, kind: Backing = 'local'): T {
    const raw = safeStorage.get(key, kind);
    if (raw == null) return fallback;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  },

  setJson<T>(key: string, value: T, kind: Backing = 'local'): void {
    try {
      safeStorage.set(key, JSON.stringify(value), kind);
    } catch {
      /* noop */
    }
  },
};

export default safeStorage;
