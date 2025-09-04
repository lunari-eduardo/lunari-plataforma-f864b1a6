/**
 * Sales Data Source Factory
 * Creates appropriate data source based on environment configuration
 */

import { SalesDataSource } from './SalesDataSource';
import { LocalStorageSalesDataSource } from './LocalStorageSalesDataSource';
import { SupabaseSalesDataSource } from './SupabaseSalesDataSource';

export type SalesDataSourceType = 'localStorage' | 'supabase';

export interface SalesDataSourceFactoryConfig {
  type?: SalesDataSourceType;
  enableCache?: boolean;
  cacheDuration?: number;
  enableDebugLogs?: boolean;
}

export class SalesDataSourceFactory {
  static create(config: SalesDataSourceFactoryConfig = {}): SalesDataSource {
    // Determine data source type
    const dataSourceType = config.type || this.getDefaultDataSourceType();
    
    // Common configuration
    const commonConfig = {
      enableCache: config.enableCache ?? true,
      cacheDuration: config.cacheDuration ?? 5 * 60 * 1000, // 5 minutes
      enableDebugLogs: config.enableDebugLogs ?? (import.meta.env.VITE_DEBUG_SALES === 'true')
    };

    switch (dataSourceType) {
      case 'supabase':
        console.log('🔌 [SalesDataSourceFactory] Creating Supabase data source');
        return new SupabaseSalesDataSource(commonConfig);
      
      case 'localStorage':
      default:
        console.log('🏪 [SalesDataSourceFactory] Creating LocalStorage data source');
        return new LocalStorageSalesDataSource(commonConfig);
    }
  }

  private static getDefaultDataSourceType(): SalesDataSourceType {
    // Check environment variable for data source preference
    const envDataSource = import.meta.env.VITE_SALES_DATA_SOURCE as SalesDataSourceType;
    
    if (envDataSource && ['localStorage', 'supabase'].includes(envDataSource)) {
      return envDataSource;
    }

    // Check if Supabase is configured
    const hasSupabaseConfig = !!(
      import.meta.env.VITE_SUPABASE_URL && 
      import.meta.env.VITE_SUPABASE_ANON_KEY
    );

    if (hasSupabaseConfig) {
      console.log('🔌 [SalesDataSourceFactory] Supabase configuration detected, using Supabase data source');
      return 'supabase';
    }

    // Default to localStorage
    console.log('🏪 [SalesDataSourceFactory] No Supabase configuration, using LocalStorage data source');
    return 'localStorage';
  }

  static getSupportedDataSources(): SalesDataSourceType[] {
    return ['localStorage', 'supabase'];
  }

  static isSupabaseAvailable(): boolean {
    return !!(
      import.meta.env.VITE_SUPABASE_URL && 
      import.meta.env.VITE_SUPABASE_ANON_KEY
    );
  }
}