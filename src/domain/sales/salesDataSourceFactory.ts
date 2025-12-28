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
    // ALWAYS use Supabase - this is the primary data source
    // The project is connected to Supabase, so always use it
    console.log('🔌 [SalesDataSourceFactory] Usando Supabase como fonte de dados');
    return 'supabase';
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