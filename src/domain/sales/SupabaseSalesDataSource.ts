/**
 * Supabase Sales Data Source (Stub)
 * Future implementation for Supabase integration
 */

import { SalesDataSource, SalesDataSourceConfig } from './SalesDataSource';
import { SalesSession, SalesFilters } from './sales-domain';

export class SupabaseSalesDataSource implements SalesDataSource {
  private config: SalesDataSourceConfig;

  constructor(config: SalesDataSourceConfig = {}) {
    this.config = {
      enableCache: false, // Supabase handles caching
      enableDebugLogs: false,
      ...config
    };
  }

  async getSessions(filters?: Partial<SalesFilters>): Promise<SalesSession[]> {
    // TODO: Implement Supabase queries
    console.warn('🚧 [SupabaseDataSource] Supabase integration not yet implemented - falling back to empty array');
    return [];
  }

  async getAvailableYears(): Promise<number[]> {
    // TODO: Implement Supabase queries
    console.warn('🚧 [SupabaseDataSource] Supabase integration not yet implemented');
    return [new Date().getFullYear()];
  }

  async getAvailableCategories(): Promise<string[]> {
    // TODO: Implement Supabase queries
    console.warn('🚧 [SupabaseDataSource] Supabase integration not yet implemented');
    return [];
  }
}

/* 
Future Supabase Implementation:

import { createClient } from '@supabase/supabase-js';

export class SupabaseSalesDataSource implements SalesDataSource {
  private supabase;

  constructor(config: SalesDataSourceConfig = {}) {
    this.supabase = createClient(
      process.env.VITE_SUPABASE_URL!,
      process.env.VITE_SUPABASE_ANON_KEY!
    );
  }

  async getSessions(filters?: Partial<SalesFilters>): Promise<SalesSession[]> {
    let query = this.supabase
      .from('workflow_sessions')
      .select(`
        *,
        clients (
          id,
          nome,
          email,
          telefone,
          origem
        )
      `)
      .neq('status', 'Cancelado');

    if (filters?.year) {
      query = query.gte('data', `${filters.year}-01-01`)
                   .lt('data', `${filters.year + 1}-01-01`);
    }

    if (filters?.month !== undefined && filters?.month !== null) {
      const year = filters.year || new Date().getFullYear();
      const startDate = new Date(year, filters.month, 1);
      const endDate = new Date(year, filters.month + 1, 1);
      query = query.gte('data', startDate.toISOString().split('T')[0])
                   .lt('data', endDate.toISOString().split('T')[0]);
    }

    if (filters?.category && filters.category !== 'all') {
      query = query.eq('categoria', filters.category);
    }

    const { data, error } = await query;
    
    if (error) {
      console.error('Error fetching sessions:', error);
      return [];
    }

    return this.mapSupabaseToSessions(data || []);
  }

  private mapSupabaseToSessions(data: any[]): SalesSession[] {
    return data.map(item => ({
      id: item.id,
      sessionId: item.session_id,
      date: item.data,
      time: item.hora || '',
      clientName: item.clients?.nome || '',
      clientPhone: item.clients?.telefone || '',
      clientEmail: item.clients?.email || '',
      description: item.descricao || '',
      status: item.status || '',
      category: item.categoria || '',
      package: item.pacote || '',
      packageValue: item.valor_pacote || 0,
      discount: item.desconto || 0,
      extraPhotoValue: item.valor_foto_extra || 0,
      extraPhotoCount: item.qtd_fotos_extra || 0,
      totalExtraPhotoValue: item.valor_total_foto_extra || 0,
      additionalValue: item.valor_adicional || 0,
      details: item.detalhes || '',
      total: item.total || 0,
      amountPaid: item.valor_pago || 0,
      remaining: (item.total || 0) - (item.valor_pago || 0),
      source: item.fonte || 'agenda',
      clientId: item.client_id,
      origin: item.origem || item.clients?.origem || 'nao-especificado',
      month: new Date(item.data).getMonth(),
      year: new Date(item.data).getFullYear(),
      parsedDate: new Date(item.data)
    }));
  }
}
*/