import localforage from 'localforage';

const CACHE_VERSION = '3.0';
const TTL_HOURS = 6;

interface CachedData<T> {
  version: string;
  tsStored: number;
  data: T;
}

class IndexedDBCache {
  private store: LocalForage;

  constructor(storeName: string = 'workflow-cache') {
    this.store = localforage.createInstance({
      name: 'photoflow-app',
      storeName: storeName,
      driver: [localforage.INDEXEDDB, localforage.LOCALSTORAGE]
    });
  }

  private getCacheKey(userId: string, year: number, month: number): string {
    return `${userId}:${year}-${String(month).padStart(2, '0')}`;
  }

  private isExpired(tsStored: number): boolean {
    const now = Date.now();
    const ageHours = (now - tsStored) / (1000 * 60 * 60);
    return ageHours > TTL_HOURS;
  }

  async get<T>(userId: string, year: number, month: number): Promise<T | null> {
    try {
      const key = this.getCacheKey(userId, year, month);
      const cached = await this.store.getItem<CachedData<T>>(key);

      if (!cached) return null;

      // Verificar versão
      if (cached.version !== CACHE_VERSION) {
        await this.store.removeItem(key);
        return null;
      }

      // Verificar TTL
      if (this.isExpired(cached.tsStored)) {
        await this.store.removeItem(key);
        return null;
      }

      return cached.data;
    } catch (error) {
      console.error('IndexedDB get error:', error);
      return null;
    }
  }

  async set<T>(userId: string, year: number, month: number, data: T): Promise<void> {
    try {
      const key = this.getCacheKey(userId, year, month);
      const cached: CachedData<T> = {
        version: CACHE_VERSION,
        tsStored: Date.now(),
        data
      };
      await this.store.setItem(key, cached);
    } catch (error) {
      console.error('IndexedDB set error:', error);
    }
  }

  async remove(userId: string, year: number, month: number): Promise<void> {
    try {
      const key = this.getCacheKey(userId, year, month);
      await this.store.removeItem(key);
    } catch (error) {
      console.error('IndexedDB remove error:', error);
    }
  }

  async clearAll(): Promise<void> {
    try {
      await this.store.clear();
    } catch (error) {
      console.error('IndexedDB clearAll error:', error);
    }
  }

  async clearUser(userId: string): Promise<void> {
    try {
      const keys = await this.store.keys();
      const userKeys = keys.filter(key => key.startsWith(`${userId}:`));
      await Promise.all(userKeys.map(key => this.store.removeItem(key)));
    } catch (error) {
      console.error('IndexedDB clearUser error:', error);
    }
  }
}

export const indexedDBCache = new IndexedDBCache();
