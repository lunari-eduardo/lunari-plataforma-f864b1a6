/**
 * Supabase Sales Data Source
 * Fetches sales data from clientes_sessoes table
 */

import { SalesDataSource, SalesDataSourceConfig } from './SalesDataSource';
import { SalesSession, SalesFilters } from './sales-domain';
import { supabase } from '@/integrations/supabase/client';

export class SupabaseSalesDataSource implements SalesDataSource {
  private config: SalesDataSourceConfig;

  constructor(config: SalesDataSourceConfig = {}) {
    this.config = {
      enableCache: false,
      enableDebugLogs: false,
      ...config
    };
  }

  async getSessions(filters?: Partial<SalesFilters>): Promise<SalesSession[]> {
    try {
      let query = supabase
        .from('clientes_sessoes')
        .select(`
          *,
          clientes (
            id,
            nome,
            email,
            telefone,
            whatsapp,
            origem
          )
        `)
        .neq('status', 'cancelado');

      // Apply year filter
      if (filters?.year) {
        const startDate = `${filters.year}-01-01`;
        const endDate = `${filters.year + 1}-01-01`;
        query = query.gte('data_sessao', startDate).lt('data_sessao', endDate);
      }

      // Apply month filter
      if (filters?.month !== undefined && filters?.month !== null) {
        const year = filters.year || new Date().getFullYear();
        const month = filters.month + 1; // Convert 0-indexed to 1-indexed
        const startDate = `${year}-${month.toString().padStart(2, '0')}-01`;
        
        // Calculate end date (first day of next month)
        const endMonth = month === 12 ? 1 : month + 1;
        const endYear = month === 12 ? year + 1 : year;
        const endDate = `${endYear}-${endMonth.toString().padStart(2, '0')}-01`;
        
        query = query.gte('data_sessao', startDate).lt('data_sessao', endDate);
      }

      // Apply category filter
      if (filters?.category && filters.category !== 'all') {
        query = query.eq('categoria', filters.category);
      }

      const { data, error } = await query.order('data_sessao', { ascending: false });
      
      if (error) {
        console.error('[SupabaseDataSource] Error fetching sessions:', error);
        return [];
      }

      if (this.config.enableDebugLogs) {
        console.log(`[SupabaseDataSource] Fetched ${data?.length || 0} sessions`);
      }

      return this.mapSupabaseToSessions(data || []);
    } catch (error) {
      console.error('[SupabaseDataSource] Unexpected error:', error);
      return [];
    }
  }

  async getAvailableYears(): Promise<number[]> {
    try {
      const { data, error } = await supabase
        .from('clientes_sessoes')
        .select('data_sessao')
        .neq('status', 'cancelado');
      
      if (error) {
        console.error('[SupabaseDataSource] Error fetching years:', error);
        return [new Date().getFullYear()];
      }

      const years = new Set<number>();
      data?.forEach(row => {
        if (row.data_sessao) {
          const year = new Date(row.data_sessao).getFullYear();
          if (!isNaN(year)) years.add(year);
        }
      });

      // Add current year if no data
      if (years.size === 0) {
        years.add(new Date().getFullYear());
      }

      return Array.from(years).sort((a, b) => b - a);
    } catch (error) {
      console.error('[SupabaseDataSource] Unexpected error:', error);
      return [new Date().getFullYear()];
    }
  }

  async getAvailableCategories(): Promise<string[]> {
    try {
      const { data, error } = await supabase
        .from('clientes_sessoes')
        .select('categoria')
        .neq('status', 'cancelado');
      
      if (error) {
        console.error('[SupabaseDataSource] Error fetching categories:', error);
        return [];
      }

      const categories = new Set<string>();
      data?.forEach(row => {
        if (row.categoria && row.categoria.trim()) {
          categories.add(row.categoria);
        }
      });

      return Array.from(categories).sort();
    } catch (error) {
      console.error('[SupabaseDataSource] Unexpected error:', error);
      return [];
    }
  }

  private mapSupabaseToSessions(data: any[]): SalesSession[] {
    return data.map(item => {
      const parsedDate = new Date(item.data_sessao);
      const valorPago = Number(item.valor_pago) || 0;
      const valorTotal = Number(item.valor_total) || 0;
      
      return {
        id: item.id,
        sessionId: item.session_id,
        date: item.data_sessao,
        time: item.hora_sessao || '',
        clientName: item.clientes?.nome || '',
        clientPhone: item.clientes?.telefone || item.clientes?.whatsapp || '',
        clientEmail: item.clientes?.email || '',
        description: item.descricao || '',
        status: item.status || '',
        category: item.categoria || '',
        package: item.pacote || '',
        packageValue: Number(item.valor_base_pacote) || 0,
        discount: Number(item.desconto) || 0,
        extraPhotoValue: Number(item.valor_foto_extra) || 0,
        extraPhotoCount: Number(item.qtd_fotos_extra) || 0,
        totalExtraPhotoValue: Number(item.valor_total_foto_extra) || 0,
        additionalValue: Number(item.valor_adicional) || 0,
        details: item.detalhes || '',
        total: valorTotal,
        amountPaid: valorPago,
        remaining: valorTotal - valorPago,
        source: 'agenda' as const,
        clientId: item.cliente_id,
        origin: item.clientes?.origem || 'nao-especificado',
        month: parsedDate.getMonth(),
        year: parsedDate.getFullYear(),
        parsedDate
      };
    });
  }
}
