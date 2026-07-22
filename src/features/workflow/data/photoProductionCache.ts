import localforage from "localforage";

/**
 * Cache SWR das métricas de produção fotográfica do Workflow.
 * Padrão copiado de `metricsCache.ts` (memory-first + IndexedDB + TTL curto).
 * Chave: `${userId}:YYYY-MM[:cat]`.
 */

export interface CachedPhotoProduction {
  fotosIncluidas: number;
  fotosExtras: number;
  fotosTotal: number;
  sessoesComPacote: number;
  sessoesSemPacote: number;
  mediaFotosPorSessao: number;
  categoriaTop: string | null;
  fotosCategoriaTop: number;
}

interface Entry {
  version: string;
  tsStored: number;
  data: CachedPhotoProduction;
}

const CACHE_VERSION = "1.0";
const TTL_MS = 90 * 1000;

const store = localforage.createInstance({
  name: "photoflow-app",
  storeName: "workflow-photo-production-cache",
  driver: [localforage.INDEXEDDB, localforage.LOCALSTORAGE],
});

const memory = new Map<string, Entry>();

const keyOf = (userId: string, y: number, m: number, cat?: string | null) =>
  `${userId}:${y}-${String(m).padStart(2, "0")}${cat ? `:${cat}` : ""}`;

const isFresh = (e: Entry) => Date.now() - e.tsStored < TTL_MS;

export const photoProductionCache = {
  getSync(userId: string, y: number, m: number, cat?: string | null): CachedPhotoProduction | null {
    const e = memory.get(keyOf(userId, y, m, cat));
    if (!e || e.version !== CACHE_VERSION || !isFresh(e)) return null;
    return e.data;
  },

  async get(userId: string, y: number, m: number, cat?: string | null): Promise<CachedPhotoProduction | null> {
    const key = keyOf(userId, y, m, cat);
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

  set(userId: string, y: number, m: number, data: CachedPhotoProduction, cat?: string | null) {
    const key = keyOf(userId, y, m, cat);
    const entry: Entry = { version: CACHE_VERSION, tsStored: Date.now(), data };
    memory.set(key, entry);
    store.setItem(key, entry).catch(() => {});
  },

  invalidate(userId: string, y: number, m: number, cat?: string | null) {
    const key = keyOf(userId, y, m, cat);
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
