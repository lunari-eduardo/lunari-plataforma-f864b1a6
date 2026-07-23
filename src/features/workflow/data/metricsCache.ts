import localforage from "localforage";

/**
 * Cache SWR das métricas do Workflow.
 * - Memory-first (síncrono) para hits instantâneos ao trocar de mês.
 * - Espelhado em IndexedDB (via localforage) para sobreviver a reloads.
 * - TTL curto (90s) porque métricas invalidam facilmente após pagamento.
 *
 * Chave: `${userId}:YYYY-MM`.
 */

export interface CachedMetrics {
  previsto: number;
  receita: number;
  aReceber: number;
  sessoes: number;
  creditosGerados: number;
  creditosUtilizados: number;
  caixaRecebido: number;
}

interface Entry {
  version: string;
  tsStored: number;
  data: CachedMetrics;
}

const CACHE_VERSION = "1.1";
// SWR: mantém dados frescos por 24h; invalidação real vem por eventos
// (workflow.card_updated, payment_added, metrics_stale, realtime).
const TTL_MS = 24 * 60 * 60 * 1000;


const store = localforage.createInstance({
  name: "photoflow-app",
  storeName: "workflow-metrics-cache",
  driver: [localforage.INDEXEDDB, localforage.LOCALSTORAGE],
});

const memory = new Map<string, Entry>();

const keyOf = (userId: string, y: number, m: number) =>
  `${userId}:${y}-${String(m).padStart(2, "0")}`;

const isFresh = (e: Entry) => Date.now() - e.tsStored < TTL_MS;

export const metricsCache = {
  /** Leitura síncrona (memory-only). Retorna null se ausente/expirado. */
  getSync(userId: string, y: number, m: number): CachedMetrics | null {
    const e = memory.get(keyOf(userId, y, m));
    if (!e || e.version !== CACHE_VERSION || !isFresh(e)) return null;
    return e.data;
  },

  /** Leitura assíncrona: consulta IDB se memory-miss e reidrata a memória. */
  async get(userId: string, y: number, m: number): Promise<CachedMetrics | null> {
    const key = keyOf(userId, y, m);
    const inMem = memory.get(key);
    if (inMem && inMem.version === CACHE_VERSION && isFresh(inMem)) return inMem.data;
    try {
      const persisted = await store.getItem<Entry>(key);
      if (!persisted || persisted.version !== CACHE_VERSION) return null;
      if (!isFresh(persisted)) {
        await store.removeItem(key).catch(() => {});
        return null;
      }
      memory.set(key, persisted);
      return persisted.data;
    } catch {
      return null;
    }
  },

  set(userId: string, y: number, m: number, data: CachedMetrics) {
    const key = keyOf(userId, y, m);
    const entry: Entry = { version: CACHE_VERSION, tsStored: Date.now(), data };
    memory.set(key, entry);
    // Fire-and-forget para IDB.
    store.setItem(key, entry).catch(() => {});
  },

  invalidate(userId: string, y: number, m: number) {
    const key = keyOf(userId, y, m);
    memory.delete(key);
    store.removeItem(key).catch(() => {});
  },

  invalidateAll(userId: string) {
    for (const k of Array.from(memory.keys())) {
      if (k.startsWith(`${userId}:`)) memory.delete(k);
    }
    store
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith(`${userId}:`)).map((k) => store.removeItem(k))))
      .catch(() => {});
  },
};
