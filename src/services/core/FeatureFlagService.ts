/**
 * Feature Flag Service
 * Manages runtime switching between storage adapters and features
 */

export interface FeatureFlags {
  USE_SUPABASE_STORAGE: boolean;
  USE_ENHANCED_VALIDATION: boolean;
  USE_AUTOMATIC_BACKUP: boolean;
  DEBUG_STORAGE_OPERATIONS: boolean;
}

export class FeatureFlagService {
  private static instance: FeatureFlagService;
  private flags: FeatureFlags;

  private constructor() {
    this.flags = {
      USE_SUPABASE_STORAGE: this.getBooleanFlag('VITE_USE_SUPABASE_STORAGE', false),
      USE_ENHANCED_VALIDATION: this.getBooleanFlag('VITE_USE_ENHANCED_VALIDATION', true),
      USE_AUTOMATIC_BACKUP: this.getBooleanFlag('VITE_USE_AUTOMATIC_BACKUP', false),
      DEBUG_STORAGE_OPERATIONS: this.getBooleanFlag('VITE_DEBUG_STORAGE', false)
    };
  }

  static getInstance(): FeatureFlagService {
    if (!FeatureFlagService.instance) {
      FeatureFlagService.instance = new FeatureFlagService();
    }
    return FeatureFlagService.instance;
  }

  private getBooleanFlag(key: string, defaultValue: boolean): boolean {
    const value = import.meta.env[key];
    if (value === undefined) return defaultValue;
    return value === 'true' || value === '1';
  }

  getFlag<K extends keyof FeatureFlags>(flag: K): FeatureFlags[K] {
    return this.flags[flag];
  }

  setFlag<K extends keyof FeatureFlags>(flag: K, value: FeatureFlags[K]): void {
    this.flags[flag] = value;
    console.log(`🏳️ Feature flag ${flag} set to:`, value);
  }

  getAllFlags(): FeatureFlags {
    return { ...this.flags };
  }

  isSupabaseEnabled(): boolean {
    return this.getFlag('USE_SUPABASE_STORAGE');
  }

  shouldUseValidation(): boolean {
    return this.getFlag('USE_ENHANCED_VALIDATION');
  }

  shouldDebugStorage(): boolean {
    return this.getFlag('DEBUG_STORAGE_OPERATIONS');
  }
}

export const featureFlagService = FeatureFlagService.getInstance();