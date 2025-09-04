/**
 * LocalStorage Sales Data Source
 * Reads data from localStorage and provides normalized SalesSession objects
 */

import { SalesDataSource, SalesDataSourceConfig } from './SalesDataSource';
import { SalesSession, SalesFilters } from './sales-domain';
import { parseMonetaryValue } from '@/utils/workflowSessionsAdapter';
import { unifiedStorageService } from '@/services/storage/UnifiedStorageService';

export class LocalStorageSalesDataSource implements SalesDataSource {
  private cache: SalesSession[] | null = null;
  private lastCacheUpdate: number = 0;
  private config: SalesDataSourceConfig;

  constructor(config: SalesDataSourceConfig = {}) {
    this.config = {
      enableCache: true,
      cacheDuration: 5 * 60 * 1000, // 5 minutes
      enableDebugLogs: false,
      ...config
    };
  }

  private log(message: string, ...args: any[]) {
    if (this.config.enableDebugLogs) {
      console.log(`🏪 [LocalStorageDataSource] ${message}`, ...args);
    }
  }

  private shouldUseCache(): boolean {
    if (!this.config.enableCache || !this.cache) return false;
    return (Date.now() - this.lastCacheUpdate) < (this.config.cacheDuration || 0);
  }

  private async loadRawSessions(): Promise<any[]> {
    try {
      const sessions = unifiedStorageService.loadRaw('workflow_sessions', []);
      if (!sessions || sessions.length === 0) {
        this.log('No workflow_sessions data found');
        return [];
      }

      this.log(`Loaded ${sessions.length} raw sessions from localStorage`);
      return sessions;
    } catch (error) {
      console.error('❌ [LocalStorageDataSource] Error loading raw sessions:', error);
      return [];
    }
  }

  private async loadClientOrigin(clientId?: string): Promise<string> {
    if (!clientId) return 'nao-especificado';

    try {
      const clientsData = unifiedStorageService.loadRaw('lunari_clients', []);
      const clients = Array.isArray(clientsData) ? clientsData : JSON.parse(clientsData || '[]');
      const client = clients.find((c: any) => c.id === clientId);
      
      if (client?.origem) {
        this.log(`Found origin in CRM: ${client.nome} → ${client.origem}`);
        return client.origem;
      }
      
      return 'nao-especificado';
    } catch (error) {
      console.warn(`❌ [LocalStorageDataSource] Error loading client origin for ${clientId}:`, error);
      return 'nao-especificado';
    }
  }

  private async normalizeSessions(rawSessions: any[]): Promise<SalesSession[]> {
    const normalizedSessions: SalesSession[] = [];

    for (let index = 0; index < rawSessions.length; index++) {
      const session = rawSessions[index];
      
      try {
        // Parse and validate date
        const dateStr = session.data;
        if (!dateStr) {
          this.log(`Session ${index} has no valid date`);
          continue;
        }

        let date: Date;
        if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
          const [year, month, day] = dateStr.split('-').map(Number);
          date = new Date(year, month - 1, day);
        } else {
          date = new Date(dateStr);
        }
        
        if (isNaN(date.getTime())) {
          this.log(`Invalid date for session ${index}: ${dateStr}`);
          continue;
        }

        // Parse monetary values
        const total = parseMonetaryValue(session.total || session.valor || 0);
        const amountPaid = parseMonetaryValue(session.valorPago || 0);
        const packageValue = parseMonetaryValue(session.valorPacote || 0);
        const totalExtraPhotoValue = parseMonetaryValue(session.valorTotalFotoExtra || 0);
        const additionalValue = parseMonetaryValue(session.valorAdicional || 0);

        // Get client origin
        const clientOrigin = await this.loadClientOrigin(session.clienteId);
        const finalOrigin = clientOrigin !== 'nao-especificado' 
          ? clientOrigin 
          : (session.origemCliente || session.origem || 'nao-especificado');

        const normalizedSession: SalesSession = {
          id: session.id || `session-${index}`,
          sessionId: session.sessionId || session.id || `session-${index}`,
          date: dateStr,
          time: session.hora || '',
          clientName: session.nome || '',
          clientPhone: session.whatsapp || '',
          clientEmail: session.email || '',
          description: session.descricao || '',
          status: session.status || '',
          category: session.categoria || '',
          package: session.pacote || '',
          packageValue: packageValue,
          discount: session.desconto || 0,
          extraPhotoValue: parseMonetaryValue(session.valorFotoExtra || 0),
          extraPhotoCount: session.qtdFotosExtra || 0,
          totalExtraPhotoValue: totalExtraPhotoValue,
          additionalValue: additionalValue,
          details: session.detalhes || '',
          total: total,
          amountPaid: amountPaid,
          remaining: total - amountPaid,
          source: session.fonte || 'agenda',
          clientId: session.clienteId,
          origin: finalOrigin,
          month: date.getMonth(),
          year: date.getFullYear(),
          parsedDate: date
        };

        normalizedSessions.push(normalizedSession);
      } catch (error) {
        console.error(`❌ [LocalStorageDataSource] Error normalizing session ${index}:`, error);
      }
    }

    // Filter out cancelled sessions
    const activeSessions = normalizedSessions.filter(session => session.status !== 'Cancelado');
    
    this.log(`Normalized ${normalizedSessions.length} sessions (${activeSessions.length} active)`);
    return activeSessions;
  }

  async getSessions(filters?: Partial<SalesFilters>): Promise<SalesSession[]> {
    // Check cache first
    if (this.shouldUseCache() && this.cache) {
      this.log('Using cached sessions data');
      return this.applyFilters(this.cache, filters);
    }

    // Load fresh data
    this.log('Loading fresh sessions data...');
    const rawSessions = await this.loadRawSessions();
    const normalizedSessions = await this.normalizeSessions(rawSessions);
    
    // Update cache
    if (this.config.enableCache) {
      this.cache = normalizedSessions;
      this.lastCacheUpdate = Date.now();
    }

    return this.applyFilters(normalizedSessions, filters);
  }

  private applyFilters(sessions: SalesSession[], filters?: Partial<SalesFilters>): SalesSession[] {
    if (!filters) return sessions;

    return sessions.filter(session => {
      if (filters.year && session.year !== filters.year) return false;
      if (filters.month !== undefined && filters.month !== null && session.month !== filters.month) return false;
      if (filters.category && filters.category !== 'all' && session.category !== filters.category) return false;
      return true;
    });
  }

  async getAvailableYears(): Promise<number[]> {
    const sessions = await this.getSessions();
    const years = new Set<number>();
    
    sessions.forEach(session => years.add(session.year));
    
    if (years.size === 0) {
      years.add(new Date().getFullYear());
    }
    
    const sortedYears = Array.from(years).sort((a, b) => b - a);
    this.log(`Available years: ${sortedYears.join(', ')}`);
    return sortedYears;
  }

  async getAvailableCategories(): Promise<string[]> {
    const sessions = await this.getSessions();
    const categories = new Set<string>();
    
    sessions.forEach(session => {
      if (session.category) {
        categories.add(session.category);
      }
    });
    
    const sortedCategories = Array.from(categories).sort();
    this.log(`Available categories: ${sortedCategories.join(', ')}`);
    return sortedCategories;
  }

  clearCache(): void {
    this.cache = null;
    this.lastCacheUpdate = 0;
    this.log('Cache cleared');
  }
}