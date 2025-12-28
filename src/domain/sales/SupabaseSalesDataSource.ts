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
      enableDebugLogs: true, // Always enable for debugging
      ...config
    };
  }

  private log(message: string, ...args: any[]) {
    console.log(`📊 [SupabaseDataSource] ${message}`, ...args);
  }

  private parseNumericValue(value: any): number {
    if (value === null || value === undefined) return 0;
    if (typeof value === 'number') return isNaN(value) ? 0 : value;
    if (typeof value === 'string') {
      const parsed = parseFloat(value);
      return isNaN(parsed) ? 0 : parsed;
    }
    return 0;
  }

  private parseDateSafe(dateStr: string): { date: Date; month: number; year: number } {
    // Parse YYYY-MM-DD format without timezone issues
    const parts = dateStr.split('-');
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1; // 0-indexed for JS
    const day = parseInt(parts[2], 10);
    
    return {
      date: new Date(year, month, day),
      month,
      year
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
        this.log('❌ Error fetching sessions:', error);
        return [];
      }

      const sessions = this.mapSupabaseToSessions(data || []);
      
      // Debug logging
      this.log(`✅ ${sessions.length} sessões carregadas`);
      
      if (sessions.length > 0) {
        const sample = sessions[0];
        this.log('📋 Amostra de sessão:', {
          sessionId: sample.sessionId,
          date: sample.date,
          month: sample.month,
          year: sample.year,
          amountPaid: sample.amountPaid,
          total: sample.total,
          category: sample.category
        });
        
        const totalRevenue = sessions.reduce((sum, s) => sum + s.amountPaid, 0);
        const totalValue = sessions.reduce((sum, s) => sum + s.total, 0);
        this.log('💰 Totais calculados:', { 
          totalRevenue, 
          totalValue,
          sessionsCount: sessions.length 
        });
      }

      return sessions;
    } catch (error) {
      this.log('❌ Unexpected error:', error);
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
      // Parse date safely without timezone issues
      const { date: parsedDate, month, year } = this.parseDateSafe(item.data_sessao);
      
      // Parse numeric values safely
      const valorPago = this.parseNumericValue(item.valor_pago);
      const valorTotal = this.parseNumericValue(item.valor_total);
      
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
        packageValue: this.parseNumericValue(item.valor_base_pacote),
        discount: this.parseNumericValue(item.desconto),
        extraPhotoValue: this.parseNumericValue(item.valor_foto_extra),
        extraPhotoCount: this.parseNumericValue(item.qtd_fotos_extra),
        totalExtraPhotoValue: this.parseNumericValue(item.valor_total_foto_extra),
        additionalValue: this.parseNumericValue(item.valor_adicional),
        details: item.detalhes || '',
        total: valorTotal,
        amountPaid: valorPago,
        remaining: valorTotal - valorPago,
        source: 'agenda' as const,
        clientId: item.cliente_id,
        origin: item.clientes?.origem || 'nao-especificado',
        month,
        year,
        parsedDate
      };
    });
  }
}
