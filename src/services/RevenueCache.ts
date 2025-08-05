import { storage, STORAGE_KEYS } from '@/utils/localStorage';
import { WorkflowItem } from '@/contexts/AppContext';

// Interface para cache de receitas mensais (preparado para Supabase)
export interface MonthlyRevenueData {
  year: number;
  month: number;
  receitaOperacional: number;
  receitasExtras: number;
  totalReceita: number;
  lastUpdated: string;
  // Campos preparados para Supabase
  id?: string;
  userId?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface RevenueCacheStructure {
  [year: string]: {
    [month: string]: MonthlyRevenueData;
  };
}

// Chaves de cache específicas (migráveis para Supabase)
export const CACHE_KEYS = {
  MONTHLY_REVENUE: 'monthly_revenue_cache',
  CACHE_VERSION: 'revenue_cache_version'
} as const;

export class RevenueCache {
  private static CURRENT_VERSION = '1.0.0';

  // Carregar cache completo
  static loadCache(): RevenueCacheStructure {
    const version = storage.load(CACHE_KEYS.CACHE_VERSION, '');
    
    // Se versão diferente, invalidar cache
    if (version !== this.CURRENT_VERSION) {
      this.clearCache();
      storage.save(CACHE_KEYS.CACHE_VERSION, this.CURRENT_VERSION);
      return {};
    }

    return storage.load(CACHE_KEYS.MONTHLY_REVENUE, {});
  }

  // Salvar cache completo
  static saveCache(cache: RevenueCacheStructure): void {
    storage.save(CACHE_KEYS.MONTHLY_REVENUE, cache);
    storage.save(CACHE_KEYS.CACHE_VERSION, this.CURRENT_VERSION);
  }

  // Obter receita de um mês específico
  static getMonthlyRevenue(year: number, month: number): MonthlyRevenueData | null {
    const cache = this.loadCache();
    return cache[year.toString()]?.[month.toString()] || null;
  }

  // Atualizar receita de um mês específico
  static updateMonthlyRevenue(
    year: number, 
    month: number, 
    receitaOperacional: number, 
    receitasExtras: number
  ): void {
    const cache = this.loadCache();
    const yearKey = year.toString();
    const monthKey = month.toString();

    if (!cache[yearKey]) {
      cache[yearKey] = {};
    }

    const existingData = cache[yearKey][monthKey];
    
    cache[yearKey][monthKey] = {
      year,
      month,
      receitaOperacional,
      receitasExtras,
      totalReceita: receitaOperacional + receitasExtras,
      lastUpdated: new Date().toISOString(),
      // Preservar dados Supabase se existirem
      ...(existingData && {
        id: existingData.id,
        userId: existingData.userId,
        createdAt: existingData.createdAt
      }),
      updatedAt: new Date().toISOString()
    };

    this.saveCache(cache);
  }

  // Recalcular cache para um ano específico
  static recalculateYearCache(
    year: number, 
    workflowItems: WorkflowItem[], 
    transacoesFinanceiras: any[]
  ): void {
    // Filtrar workflow para o ano
    const workflowDoAno = workflowItems.filter(item => {
      try {
        const itemYear = new Date(item.data).getFullYear();
        return itemYear === year;
      } catch {
        return false;
      }
    });

    // Filtrar transações para o ano
    const transacoesDoAno = transacoesFinanceiras.filter(transacao => {
      if (!transacao.dataVencimento || typeof transacao.dataVencimento !== 'string') {
        return false;
      }
      const anoTransacao = parseInt(transacao.dataVencimento.split('-')[0]);
      return anoTransacao === year;
    });

    // Calcular receitas por mês
    for (let month = 1; month <= 12; month++) {
      // Receita operacional do workflow
      const receitaOperacional = workflowDoAno
        .filter(item => {
          const itemMonth = new Date(item.data).getMonth() + 1;
          return itemMonth === month;
        })
        .reduce((sum, item) => sum + item.valorPago, 0);

      // Receitas extras das transações
      const receitasExtras = transacoesDoAno
        .filter(t => {
          if (!t.dataVencimento || typeof t.dataVencimento !== 'string') return false;
          const mesTransacao = parseInt(t.dataVencimento.split('-')[1]);
          return mesTransacao === month && 
                 t.status === 'Pago' && 
                 t.item?.grupo_principal === 'Receita Não Operacional';
        })
        .reduce((sum, t) => sum + t.valor, 0);

      // Atualizar cache apenas se há dados
      if (receitaOperacional > 0 || receitasExtras > 0) {
        this.updateMonthlyRevenue(year, month, receitaOperacional, receitasExtras);
      }
    }
  }

  // Invalidar cache específico
  static invalidateMonth(year: number, month: number): void {
    const cache = this.loadCache();
    const yearKey = year.toString();
    
    if (cache[yearKey]?.[month.toString()]) {
      delete cache[yearKey][month.toString()];
      this.saveCache(cache);
    }
  }

  // Limpar todo o cache
  static clearCache(): void {
    storage.remove(CACHE_KEYS.MONTHLY_REVENUE);
    storage.remove(CACHE_KEYS.CACHE_VERSION);
  }

  // Obter todos os anos com dados
  static getAvailableYears(): number[] {
    const cache = this.loadCache();
    return Object.keys(cache)
      .map(year => parseInt(year))
      .filter(year => !isNaN(year))
      .sort((a, b) => b - a);
  }

  // Obter resumo anual
  static getYearSummary(year: number): {
    totalReceitaOperacional: number;
    totalReceitasExtras: number;
    totalReceita: number;
    mesesComDados: number;
  } {
    const cache = this.loadCache();
    const yearData = cache[year.toString()] || {};
    
    let totalReceitaOperacional = 0;
    let totalReceitasExtras = 0;
    let mesesComDados = 0;

    Object.values(yearData).forEach(monthData => {
      totalReceitaOperacional += monthData.receitaOperacional;
      totalReceitasExtras += monthData.receitasExtras;
      mesesComDados++;
    });

    return {
      totalReceitaOperacional,
      totalReceitasExtras,
      totalReceita: totalReceitaOperacional + totalReceitasExtras,
      mesesComDados
    };
  }

  // Preparar dados para migração Supabase
  static prepareForSupabaseMigration(): {
    monthlyRevenues: MonthlyRevenueData[];
    metadata: {
      totalRecords: number;
      yearsCovered: number[];
      lastUpdated: string;
    };
  } {
    const cache = this.loadCache();
    const monthlyRevenues: MonthlyRevenueData[] = [];

    Object.entries(cache).forEach(([year, yearData]) => {
      Object.values(yearData).forEach(monthData => {
        monthlyRevenues.push({
          ...monthData,
          // Gerar ID único se não existir
          id: monthData.id || `${monthData.year}-${monthData.month.toString().padStart(2, '0')}`,
          // Preparar para user_id do Supabase
          userId: monthData.userId || 'temp-user-id'
        });
      });
    });

    return {
      monthlyRevenues,
      metadata: {
        totalRecords: monthlyRevenues.length,
        yearsCovered: this.getAvailableYears(),
        lastUpdated: new Date().toISOString()
      }
    };
  }
}