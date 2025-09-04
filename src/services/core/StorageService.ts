/**
 * Enhanced Storage Service
 * Provides type-safe, performant storage operations with error handling and Zod validation
 */

import { storage, STORAGE_KEYS } from '@/utils/localStorage';
import { z, ZodSchema } from 'zod';

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
  private validationErrors = new Map<string, string[]>();

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
   * Save raw data (for non-cataloged keys)
   */
  saveRaw(key: string, data: any): boolean {
    try {
      const sanitizedData = this.sanitizeData(data);
      localStorage.setItem(key, JSON.stringify(sanitizedData));
      return true;
    } catch (error) {
      console.error(`Error saving raw data for key ${key}:`, error);
      return false;
    }
  }

  /**
   * Load raw data (for non-cataloged keys)
   */
  loadRaw<T>(key: string, defaultValue: T): T {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : defaultValue;
    } catch (error) {
      console.error(`Error loading raw data for key ${key}:`, error);
      return defaultValue;
    }
  }

  /**
   * Get all localStorage keys
   */
  getAllKeys(): string[] {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) keys.push(key);
    }
    return keys;
  }

  /**
   * Save with Zod validation
   */
  saveWithValidation<T>(key: keyof typeof STORAGE_KEYS, data: T, schema: ZodSchema<T>): boolean {
    try {
      const validationResult = schema.safeParse(data);
      
      if (!validationResult.success) {
        const errors = validationResult.error.issues.map(issue => 
          `${issue.path.join('.')}: ${issue.message}`
        );
        this.validationErrors.set(STORAGE_KEYS[key], errors);
        console.error(`Validation failed for ${key}:`, errors);
        return false;
      }

      this.validationErrors.delete(STORAGE_KEYS[key]);
      return this.save(key, validationResult.data);
    } catch (error) {
      console.error(`Error saving with validation for ${key}:`, error);
      return false;
    }
  }

  /**
   * Load with Zod validation
   */
  loadWithValidation<T>(key: keyof typeof STORAGE_KEYS, defaultValue: T, schema: ZodSchema<T>): T {
    const data = this.load(key, defaultValue);
    
    try {
      const validationResult = schema.safeParse(data);
      
      if (!validationResult.success) {
        const errors = validationResult.error.issues.map(issue => 
          `${issue.path.join('.')}: ${issue.message}`
        );
        this.validationErrors.set(STORAGE_KEYS[key], errors);
        console.warn(`Validation failed for ${key}, using default:`, errors);
        return defaultValue;
      }

      this.validationErrors.delete(STORAGE_KEYS[key]);
      return validationResult.data;
    } catch (error) {
      console.error(`Error validating data for ${key}:`, error);
      return defaultValue;
    }
  }

  /**
   * Sanitize data before saving
   */
  private sanitizeData(data: any): any {
    if (data === null || data === undefined) return data;
    
    if (typeof data === 'string') {
      // Remove potential XSS patterns
      return data.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    }
    
    if (Array.isArray(data)) {
      return data.map(item => this.sanitizeData(item));
    }
    
    if (typeof data === 'object') {
      const sanitized: any = {};
      for (const [key, value] of Object.entries(data)) {
        sanitized[key] = this.sanitizeData(value);
      }
      return sanitized;
    }
    
    return data;
  }

  /**
   * Get validation errors for a key
   */
  getValidationErrors(key: keyof typeof STORAGE_KEYS): string[] {
    return this.validationErrors.get(STORAGE_KEYS[key]) || [];
  }

  /**
   * Clear validation errors for a key
   */
  clearValidationErrors(key: keyof typeof STORAGE_KEYS): void {
    this.validationErrors.delete(STORAGE_KEYS[key]);
  }

  /**
   * Check data integrity
   */
  async validateDataIntegrity(): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];
    
    try {
      // Check critical data structures
      const criticalKeys: (keyof typeof STORAGE_KEYS)[] = [
        'WORKFLOW_ITEMS', 'CLIENTS', 'FIN_TRANSACTIONS', 'APPOINTMENTS'
      ];
      
      for (const key of criticalKeys) {
        const data = this.load(key, null);
        
        if (data === null) continue;
        
        if (!Array.isArray(data) && typeof data !== 'object') {
          errors.push(`${key}: Expected object or array, got ${typeof data}`);
        }
        
        if (Array.isArray(data)) {
          data.forEach((item, index) => {
            if (!item || typeof item !== 'object' || !item.id) {
              errors.push(`${key}[${index}]: Missing or invalid id field`);
            }
          });
        }
      }
      
      return { valid: errors.length === 0, errors };
    } catch (error) {
      errors.push(`Data integrity check failed: ${error}`);
      return { valid: false, errors };
    }
  }

  /**
   * Create backup of all app data
   */
  createBackup(): string {
    const backup: any = {
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      data: {}
    };
    
    Object.entries(STORAGE_KEYS).forEach(([name, key]) => {
      const data = this.load(name as keyof typeof STORAGE_KEYS, null);
      if (data !== null) {
        backup.data[name] = data;
      }
    });
    
    return JSON.stringify(backup, null, 2);
  }

  /**
   * Restore from backup
   */
  restoreFromBackup(backupData: string): boolean {
    try {
      const backup = JSON.parse(backupData);
      
      if (!backup.data) {
        throw new Error('Invalid backup format');
      }
      
      Object.entries(backup.data).forEach(([name, data]) => {
        if (name in STORAGE_KEYS) {
          this.save(name as keyof typeof STORAGE_KEYS, data);
        }
      });
      
      return true;
    } catch (error) {
      console.error('Error restoring from backup:', error);
      return false;
    }
  }

  /**
   * Get storage usage statistics
   */
  getUsageStats(): { totalKeys: number; cacheSize: number; estimatedSize: string; validationErrors: number } {
    const totalKeys = Object.keys(STORAGE_KEYS).length;
    const cacheSize = this.cache.size;
    const validationErrors = this.validationErrors.size;
    
    // Estimate storage size
    let estimatedBytes = 0;
    Object.values(STORAGE_KEYS).forEach(key => {
      const data = localStorage.getItem(key);
      if (data) estimatedBytes += data.length;
    });
    
    const estimatedSize = `${(estimatedBytes / 1024).toFixed(2)} KB`;
    
    return { totalKeys, cacheSize, estimatedSize, validationErrors };
  }
}

// Export singleton instance
export const storageService = StorageService.getInstance();