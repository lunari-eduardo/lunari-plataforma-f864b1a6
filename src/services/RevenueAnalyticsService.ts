import { storage, STORAGE_KEYS } from '@/utils/localStorage';
import { Cliente } from '@/types/orcamentos';
import { parseMonetaryValue } from '@/utils/workflowSessionsAdapter';
import { ORIGENS_PADRAO } from '@/utils/defaultOrigens';

/**
 * SERVIÇO DE ANÁLISE DE RECEITA POR ORIGEM
 * Estrutura matricial: Cliente × Origem × Total Faturado
 * Completamente migrável para Supabase
 */

export interface ClientOriginRevenue {
  clientId: string;
  clientName: string;
  clientOrigin: string;
  totalRevenue: number;
  totalPaid: number;
  totalSessions: number;
  lastSessionDate: Date | null;
}

export interface OriginRevenueMatrix {
  clientId: string;
  clientName: string;
  clientOrigin: string;
  origins: Record<string, number>; // origem → total faturado
  totalRevenue: number;
  totalSessions: number;
}

export interface OriginRevenueData {
  originId: string;
  originName: string;
  originColor: string;
  totalRevenue: number;
  totalSessions: number;
  clientCount: number;
  averageTicket: number;
  percentage: number;
}

export interface RevenueAnalyticsResult {
  clientOriginMatrix: OriginRevenueMatrix[];
  originSummary: OriginRevenueData[];
  totalRevenue: number;
  totalSessions: number;
  totalClients: number;
}

class RevenueAnalyticsService {
  private clientsCache: Cliente[] | null = null;
  private workflowSessionsCache: any[] | null = null;
  private lastCacheUpdate: number = 0;
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutos

  /**
   * Carrega dados com cache otimizado
   */
  private loadData(): { clients: Cliente[], sessions: any[] } {
    const now = Date.now();
    
    if (this.clientsCache && this.workflowSessionsCache && 
        (now - this.lastCacheUpdate) < this.CACHE_DURATION) {
      console.log('📊 [RevenueAnalytics] Usando dados do cache');
      return {
        clients: this.clientsCache,
        sessions: this.workflowSessionsCache
      };
    }

    console.log('📊 [RevenueAnalytics] Carregando dados frescos...');

    // Carregar clientes
    this.clientsCache = storage.load(STORAGE_KEYS.CLIENTS, []);
    
    // Carregar sessões do workflow
    this.workflowSessionsCache = JSON.parse(localStorage.getItem('workflow_sessions') || '[]');
    
    this.lastCacheUpdate = now;

    console.log(`📊 [RevenueAnalytics] Dados carregados: ${this.clientsCache.length} clientes, ${this.workflowSessionsCache.length} sessões`);

    return {
      clients: this.clientsCache,
      sessions: this.workflowSessionsCache
    };
  }

  /**
   * Normaliza valores financeiros
   */
  private parseFinancialValue(value: any): number {
    return parseMonetaryValue(value) || 0;
  }

  /**
   * Busca cliente por ID ou nome
   */
  private findClient(session: any, clients: Cliente[]): Cliente | null {
    // 1º: Buscar por clienteId
    if (session.clienteId) {
      const clientById = clients.find(c => c.id === session.clienteId);
      if (clientById) return clientById;
    }

    // 2º: Buscar por nome (fallback)
    if (session.nome) {
      const normalizedSessionName = session.nome.toLowerCase().trim();
      const clientByName = clients.find(c => 
        c.nome.toLowerCase().trim() === normalizedSessionName
      );
      if (clientByName) return clientByName;
    }

    return null;
  }

  /**
   * Extrai origem do cliente com prioridade
   */
  private extractClientOrigin(session: any, client: Cliente | null): string {
    // 1º: Origem do cliente no CRM (autoritativa)
    if (client?.origem) {
      return client.origem;
    }

    // 2º: Origem na sessão
    if (session.origemCliente || session.origem) {
      return session.origemCliente || session.origem;
    }

    // 3º: Fallback
    return 'nao-especificado';
  }

  /**
   * Gera a matriz de receita por cliente e origem
   */
  public generateClientOriginMatrix(year?: number, category?: string): RevenueAnalyticsResult {
    console.log(`🏗️ [RevenueAnalytics] Gerando matriz para ano: ${year || 'todos'}, categoria: ${category || 'todas'}`);

    const { clients, sessions } = this.loadData();

    // Filtrar sessões por ano e categoria se especificado
    const filteredSessions = sessions.filter(session => {
      // Filtro de status
      if (session.status === 'Cancelado') return false;

      // Filtro de ano
      if (year) {
        const sessionDate = new Date(session.data);
        if (sessionDate.getFullYear() !== year) return false;
      }

      // Filtro de categoria
      if (category && category !== 'all') {
        if (session.categoria !== category) return false;
      }

      return true;
    });

    console.log(`🔍 [RevenueAnalytics] ${filteredSessions.length} sessões após filtros`);

    // Deduplicar por sessionId
    const sessionMap = new Map();
    filteredSessions.forEach(session => {
      const sessionKey = session.sessionId || session.id;
      if (!sessionMap.has(sessionKey)) {
        sessionMap.set(sessionKey, session);
      }
    });

    const uniqueSessions = Array.from(sessionMap.values());
    console.log(`🧹 [RevenueAnalytics] ${uniqueSessions.length} sessões únicas após deduplicação`);

    // Agrupar por cliente
    const clientRevenueMap = new Map<string, {
      client: Cliente;
      sessions: any[];
      origins: Record<string, { revenue: number; sessions: number }>;
    }>();

    uniqueSessions.forEach(session => {
      const client = this.findClient(session, clients);
      if (!client) {
        console.warn(`⚠️ [RevenueAnalytics] Cliente não encontrado para sessão: ${session.nome || session.id}`);
        return;
      }

      const clientOrigin = this.extractClientOrigin(session, client);
      const revenue = this.parseFinancialValue(session.valorPago);

      if (!clientRevenueMap.has(client.id)) {
        clientRevenueMap.set(client.id, {
          client,
          sessions: [],
          origins: {}
        });
      }

      const clientData = clientRevenueMap.get(client.id)!;
      clientData.sessions.push(session);

      if (!clientData.origins[clientOrigin]) {
        clientData.origins[clientOrigin] = { revenue: 0, sessions: 0 };
      }

      clientData.origins[clientOrigin].revenue += revenue;
      clientData.origins[clientOrigin].sessions += 1;
    });

    // Gerar todas as origens possíveis
    const allOrigins = new Set<string>();
    ORIGENS_PADRAO.forEach(origem => allOrigins.add(origem.id));
    allOrigins.add('nao-especificado');

    // Construir matriz de clientes × origens
    const clientOriginMatrix: OriginRevenueMatrix[] = Array.from(clientRevenueMap.values()).map(({ client, sessions, origins }) => {
      // Criar record com todas as origens (zeradas se não houver dados)
      const allOriginsRecord: Record<string, number> = {};
      allOrigins.forEach(originId => {
        allOriginsRecord[originId] = origins[originId]?.revenue || 0;
      });

      const totalRevenue = Object.values(origins).reduce((sum, data) => sum + data.revenue, 0);
      const totalSessions = Object.values(origins).reduce((sum, data) => sum + data.sessions, 0);

      return {
        clientId: client.id,
        clientName: client.nome,
        clientOrigin: client.origem || 'nao-especificado',
        origins: allOriginsRecord,
        totalRevenue,
        totalSessions
      };
    }).sort((a, b) => b.totalRevenue - a.totalRevenue);

    // Calcular resumo por origem
    const originSummaryMap = new Map<string, {
      revenue: number;
      sessions: number;
      clients: Set<string>;
    }>();

    clientOriginMatrix.forEach(clientMatrix => {
      Object.entries(clientMatrix.origins).forEach(([originId, revenue]) => {
        if (revenue > 0) {
          if (!originSummaryMap.has(originId)) {
            originSummaryMap.set(originId, {
              revenue: 0,
              sessions: 0,
              clients: new Set()
            });
          }

          const originData = originSummaryMap.get(originId)!;
          originData.revenue += revenue;
          originData.clients.add(clientMatrix.clientId);
        }
      });
    });

    // Calcular sessões por origem dos dados brutos
    uniqueSessions.forEach(session => {
      const client = this.findClient(session, clients);
      const origin = this.extractClientOrigin(session, client);
      
      if (!originSummaryMap.has(origin)) {
        originSummaryMap.set(origin, {
          revenue: 0,
          sessions: 0,
          clients: new Set()
        });
      }

      originSummaryMap.get(origin)!.sessions += 1;
    });

    const totalRevenue = Array.from(originSummaryMap.values()).reduce((sum, data) => sum + data.revenue, 0);
    const totalSessions = Array.from(originSummaryMap.values()).reduce((sum, data) => sum + data.sessions, 0);

    const originSummary: OriginRevenueData[] = Array.from(originSummaryMap.entries()).map(([originId, data]) => {
      const matchingOrigin = ORIGENS_PADRAO.find(o => o.id === originId);
      const name = matchingOrigin?.nome || (originId === 'nao-especificado' ? 'Não especificado' : originId);
      const color = matchingOrigin?.cor || '#6B7280';

      return {
        originId,
        originName: name,
        originColor: color,
        totalRevenue: data.revenue,
        totalSessions: data.sessions,
        clientCount: data.clients.size,
        averageTicket: data.sessions > 0 ? data.revenue / data.sessions : 0,
        percentage: totalSessions > 0 ? (data.sessions / totalSessions) * 100 : 0
      };
    }).sort((a, b) => b.totalRevenue - a.totalRevenue);

    const result: RevenueAnalyticsResult = {
      clientOriginMatrix,
      originSummary,
      totalRevenue,
      totalSessions,
      totalClients: clientOriginMatrix.length
    };

    console.log(`✅ [RevenueAnalytics] Matriz gerada: ${result.totalClients} clientes, R$ ${result.totalRevenue.toLocaleString()}, ${result.originSummary.length} origens`);

    return result;
  }

  /**
   * Limpa cache para forçar recarga
   */
  public clearCache(): void {
    this.clientsCache = null;
    this.workflowSessionsCache = null;
    this.lastCacheUpdate = 0;
    console.log('🧹 [RevenueAnalytics] Cache limpo');
  }

  /**
   * Gera estrutura SQL para migração Supabase
   */
  public generateSupabaseSchemas(): string {
    return `
-- =====================================
-- SCHEMAS PARA MIGRAÇÃO SUPABASE
-- Estrutura Normalizada de Revenue Analytics
-- =====================================

-- Tabela de clientes
CREATE TABLE clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  telefone VARCHAR(20),
  endereco TEXT,
  origem VARCHAR(100),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de origens padronizadas
CREATE TABLE origins (
  id VARCHAR(50) PRIMARY KEY,
  nome VARCHAR(100) NOT NULL,
  cor VARCHAR(7) NOT NULL,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de sessões do workflow
CREATE TABLE workflow_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id VARCHAR(100) UNIQUE NOT NULL,
  client_id UUID REFERENCES clients(id),
  data DATE NOT NULL,
  hora TIME,
  categoria VARCHAR(100),
  pacote VARCHAR(100),
  status VARCHAR(50),
  valor_pacote DECIMAL(10,2) DEFAULT 0,
  valor_total_foto_extra DECIMAL(10,2) DEFAULT 0,
  valor_adicional DECIMAL(10,2) DEFAULT 0,
  desconto DECIMAL(10,2) DEFAULT 0,
  total DECIMAL(10,2) DEFAULT 0,
  valor_pago DECIMAL(10,2) DEFAULT 0,
  origem VARCHAR(100),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- View materializada para analytics de receita por origem
CREATE MATERIALIZED VIEW client_revenue_by_origin AS
SELECT 
  c.id as client_id,
  c.nome as client_name,
  c.origem as client_origin,
  COALESCE(ws.origem, c.origem, 'nao-especificado') as session_origin,
  SUM(ws.valor_pago) as total_revenue,
  COUNT(ws.id) as total_sessions,
  MAX(ws.data) as last_session_date
FROM clients c
LEFT JOIN workflow_sessions ws ON c.id = ws.client_id
WHERE ws.status != 'Cancelado' OR ws.status IS NULL
GROUP BY c.id, c.nome, c.origem, session_origin;

-- Índices para performance
CREATE INDEX idx_workflow_sessions_client_id ON workflow_sessions(client_id);
CREATE INDEX idx_workflow_sessions_data ON workflow_sessions(data);
CREATE INDEX idx_workflow_sessions_origem ON workflow_sessions(origem);
CREATE INDEX idx_workflow_sessions_status ON workflow_sessions(status);

-- Função para atualizar a view materializada
CREATE OR REPLACE FUNCTION refresh_client_revenue_analytics()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW client_revenue_by_origin;
END;
$$ LANGUAGE plpgsql;

-- Trigger para atualizar analytics automaticamente
CREATE OR REPLACE FUNCTION trigger_refresh_analytics()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM refresh_client_revenue_analytics();
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER refresh_analytics_on_session_change
AFTER INSERT OR UPDATE OR DELETE ON workflow_sessions
FOR EACH STATEMENT
EXECUTE FUNCTION trigger_refresh_analytics();
`;
  }
}

// Singleton instance
export const revenueAnalyticsService = new RevenueAnalyticsService();