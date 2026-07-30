/**
 * scripts/_shim.ts — shim compartilhado dos scripts de superfície AI.
 *
 * Node/Bun não têm `localStorage`; o client Supabase lê no import top-level e
 * quebra. Importar este módulo ANTES de qualquer import do grafo do app.
 * Antes existia uma cópia colada em cada script — divergiam com o tempo.
 */
const g = globalThis as unknown as { localStorage?: unknown };

if (!g.localStorage) {
  const store = new Map<string, string>();
  g.localStorage = {
    getItem: (k: string) => (store.has(k) ? (store.get(k) as string) : null),
    setItem: (k: string, v: string) => void store.set(k, String(v)),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
    key: (i: number) => Array.from(store.keys())[i] ?? null,
    get length() {
      return store.size;
    },
  };
}

export {};
