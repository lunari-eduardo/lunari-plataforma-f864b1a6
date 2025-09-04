/**
 * Unified Storage Service
 * Routes storage operations to appropriate adapter based on feature flags
 */

import { storageService, StorageService } from '@/services/core/StorageService';
import { featureFlagService } from '@/services/core/FeatureFlagService';
import { STORAGE_KEYS } from '@/utils/localStorage';
import { ZodSchema } from 'zod';

export class UnifiedStorageService {
  private static instance: UnifiedStorageService;
  private localStorageService: StorageService;

  private constructor() {
    this.localStorageService = storageService;
  }

  static getInstance(): UnifiedStorageService {
    if (!UnifiedStorageService.instance) {
      UnifiedStorageService.instance = new UnifiedStorageService();
    }
    return UnifiedStorageService.instance;
  }

  /**
   * Save data with automatic adapter selection
   */
  save<T>(key: keyof typeof STORAGE_KEYS, data: T): boolean {
    const useSupabase = featureFlagService.isSupabaseEnabled();
    const shouldDebug = featureFlagService.shouldDebugStorage();
    
    if (shouldDebug) {
      console.log(`💾 Saving ${key} via ${useSupabase ? 'Supabase' : 'localStorage'}`);
    }

    if (useSupabase) {
      // TODO: Route to Supabase adapter when available
      console.warn('Supabase storage not yet implemented, falling back to localStorage');
    }
    
    return this.localStorageService.save(key, data);
  }

  /**
   * Load data with automatic adapter selection
   */
  load<T>(key: keyof typeof STORAGE_KEYS, defaultValue: T, useCache = false): T {
    const useSupabase = featureFlagService.isSupabaseEnabled();
    const shouldDebug = featureFlagService.shouldDebugStorage();
    
    if (shouldDebug) {
      console.log(`📂 Loading ${key} via ${useSupabase ? 'Supabase' : 'localStorage'}`);
    }

    if (useSupabase) {
      // TODO: Route to Supabase adapter when available
      console.warn('Supabase storage not yet implemented, falling back to localStorage');
    }
    
    return this.localStorageService.load(key, defaultValue, useCache);
  }

  /**
   * Save with validation if enabled
   */
  saveWithValidation<T>(key: keyof typeof STORAGE_KEYS, data: T, schema?: ZodSchema<T>): boolean {
    const shouldValidate = featureFlagService.shouldUseValidation() && schema;
    
    if (shouldValidate) {
      return this.localStorageService.saveWithValidation(key, data, schema!);
    }
    
    return this.save(key, data);
  }

  /**
   * Load with validation if enabled
   */
  loadWithValidation<T>(key: keyof typeof STORAGE_KEYS, defaultValue: T, schema?: ZodSchema<T>): T {
    const shouldValidate = featureFlagService.shouldUseValidation() && schema;
    
    if (shouldValidate) {
      return this.localStorageService.loadWithValidation(key, defaultValue, schema!);
    }
    
    return this.load(key, defaultValue);
  }

  /**
   * Save raw data (for migration purposes)
   */
  saveRaw(key: string, data: any): boolean {
    const shouldDebug = featureFlagService.shouldDebugStorage();
    
    if (shouldDebug) {
      console.log(`💾 Saving raw key: ${key}`);
    }
    
    return this.localStorageService.saveRaw(key, data);
  }

  /**
   * Load raw data (for migration purposes)
   */
  loadRaw<T>(key: string, defaultValue: T): T {
    const shouldDebug = featureFlagService.shouldDebugStorage();
    
    if (shouldDebug) {
      console.log(`📂 Loading raw key: ${key}`);
    }
    
    return this.localStorageService.loadRaw(key, defaultValue);
  }

  /**
   * Remove data
   */
  remove(key: keyof typeof STORAGE_KEYS): void {
    const useSupabase = featureFlagService.isSupabaseEnabled();
    const shouldDebug = featureFlagService.shouldDebugStorage();
    
    if (shouldDebug) {
      console.log(`🗑️ Removing ${key} via ${useSupabase ? 'Supabase' : 'localStorage'}`);
    }

    if (useSupabase) {
      // TODO: Route to Supabase adapter when available
      console.warn('Supabase storage not yet implemented, falling back to localStorage');
    }
    
    this.localStorageService.remove(key);
  }

  /**
   * Check if data exists
   */
  exists(key: keyof typeof STORAGE_KEYS): boolean {
    return this.localStorageService.exists(key);
  }

  /**
   * Batch operations
   */
  batchSave(operations: Array<{ key: keyof typeof STORAGE_KEYS; data: any }>): boolean {
    const shouldDebug = featureFlagService.shouldDebugStorage();
    
    if (shouldDebug) {
      console.log(`📦 Batch saving ${operations.length} operations`);
    }
    
    return this.localStorageService.batchSave(operations);
  }

  /**
   * Get storage statistics
   */
  getStats() {
    return this.localStorageService.getUsageStats();
  }

  /**
   * Validate data integrity
   */
  async validateIntegrity() {
    return this.localStorageService.validateDataIntegrity();
  }

  /**
   * Create backup
   */
  createBackup(): string {
    return this.localStorageService.createBackup();
  }

  /**
   * Get all localStorage keys for migration
   */
  getAllKeys(): string[] {
    return this.localStorageService.getAllKeys();
  }
}

export const unifiedStorageService = UnifiedStorageService.getInstance();