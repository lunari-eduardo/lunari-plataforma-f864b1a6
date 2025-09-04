/**
 * Sales Data Source Interface
 * Abstraction layer for data access - supports LocalStorage and Supabase
 */

import { SalesSession, SalesFilters } from './sales-domain';

export interface SalesDataSource {
  getSessions(filters?: Partial<SalesFilters>): Promise<SalesSession[]>;
  getAvailableYears(): Promise<number[]>;
  getAvailableCategories(): Promise<string[]>;
}

export interface SalesDataSourceConfig {
  enableCache?: boolean;
  cacheDuration?: number; // milliseconds
  enableDebugLogs?: boolean;
}