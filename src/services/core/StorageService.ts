/**
 * Enhanced Storage Service
 * Provides type-safe, performant storage operations with error handling
 */

import { storage, STORAGE_KEYS } from '@/utils/localStorage';

export interface StorageMetadata {
  created_at: string;
  updated_at: string;
  version?: string;
}

export interface WithMetadata<T> extends StorageMetadata {
  data: T;
}

export class StorageService {
  private static instance: StorageService;
  private cache = new Map<string, { data: any; timestamp: number }>();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  static getInstance(): StorageService {
    if (!StorageService.instance) {
      StorageService.instance = new StorageService();
    }
    return StorageService.instance;
  }

  /**
   * Load data with optional caching and type safety
   */
  load<T>(key: keyof typeof STORAGE_KEYS, defaultValue: T, useCache = false): T {
    const cacheKey = STORAGE_KEYS[key];
    
    // Check cache first if enabled
    if (useCache && this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey)!;
      if (Date.now() - cached.timestamp < this.CACHE_TTL) {
        return cached.data;
      }
      this.cache.delete(cacheKey);
    }

    const data = storage.load(cacheKey, defaultValue);
    
    // Cache if enabled
    if (useCache) {
      this.cache.set(cacheKey, { data, timestamp: Date.now() });
    }
    
    return data;
  }

  /**
   * Save data with metadata and cache invalidation
   */
  save<T>(key: keyof typeof STORAGE_KEYS, data: T): boolean {
    try {
      const cacheKey = STORAGE_KEYS[key];
      storage.save(cacheKey, data);
      
      // Invalidate cache
      this.cache.delete(cacheKey);
      
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Save data with automatic metadata
   */
  saveWithMetadata<T>(key: keyof typeof STORAGE_KEYS, data: T): boolean {
    const withMetadata: WithMetadata<T> = {
      data,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      version: '1.0'
    };
    
    return this.save(key, withMetadata);
  }

  /**
   * Load data with metadata extraction
   */
  loadWithMetadata<T>(key: keyof typeof STORAGE_KEYS, defaultValue: T): { data: T; metadata?: StorageMetadata } {
    const stored = this.load(key, null);
    
    if (stored && typeof stored === 'object' && 'data' in stored) {
      const withMeta = stored as WithMetadata<T>;
      return {
        data: withMeta.data,
        metadata: {
          created_at: withMeta.created_at,
          updated_at: withMeta.updated_at,
          version: withMeta.version
        }
      };
    }
    
    return { data: stored || defaultValue };
  }

  /**
   * Batch operations for better performance
   */
  batchSave(operations: Array<{ key: keyof typeof STORAGE_KEYS; data: any }>): boolean {
    try {
      operations.forEach(({ key, data }) => {
        storage.save(STORAGE_KEYS[key], data);
        this.cache.delete(STORAGE_KEYS[key]);
      });
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Clear cache for specific key or all
   */
  clearCache(key?: keyof typeof STORAGE_KEYS): void {
    if (key) {
      this.cache.delete(STORAGE_KEYS[key]);
    } else {
      this.cache.clear();
    }
  }

  /**
   * Validate data existence and type
   */
  exists(key: keyof typeof STORAGE_KEYS): boolean {
    const data = storage.load(STORAGE_KEYS[key], null);
    return data !== null && data !== undefined;
  }

  /**
   * Remove specific key
   */
  remove(key: keyof typeof STORAGE_KEYS): void {
    storage.remove(STORAGE_KEYS[key]);
    this.cache.delete(STORAGE_KEYS[key]);
  }

  /**
   * Get storage usage statistics
   */
  getUsageStats(): { totalKeys: number; cacheSize: number; estimatedSize: string } {
    const totalKeys = Object.keys(STORAGE_KEYS).length;
    const cacheSize = this.cache.size;
    
    // Estimate storage size
    let estimatedBytes = 0;
    Object.values(STORAGE_KEYS).forEach(key => {
      const data = localStorage.getItem(key);
      if (data) estimatedBytes += data.length;
    });
    
    const estimatedSize = `${(estimatedBytes / 1024).toFixed(2)} KB`;
    
    return { totalKeys, cacheSize, estimatedSize };
  }
}

// Export singleton instance
export const storageService = StorageService.getInstance();