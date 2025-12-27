/**
 * Serviço de Integração de Metas
 * Centraliza acesso às metas de precificação para toda a aplicação
 * Com suporte a localStorage (sync) e Supabase (async)
 */

import { supabase } from '@/integrations/supabase/client';
import { MetasService } from '@/services/PricingService';
import type { MetasPrecificacao } from '@/types/precificacao';

interface MonthlyGoals {
  revenue: number;
  profit: number;
  profitMargin: number;
}

interface AnnualGoals {
  revenue: number;
  profit: number;
  profitMargin: number;
}

interface GoalsStatus {
  hasConfiguredGoals: boolean;
  hasRevenue: boolean;
  hasProfit: boolean;
  isComplete: boolean;
}

export class GoalsIntegrationService {
  /**
   * Verifica se as metas estão configuradas (síncrono - localStorage)
   */
  static hasConfiguredGoals(): boolean {
    try {
      const metas = MetasService.carregar();
      return metas.metaFaturamentoAnual > 0 || metas.metaLucroAnual > 0;
    } catch {
      return false;
    }
  }

  /**
   * Obtém status detalhado da configuração (síncrono - localStorage)
   */
  static getConfigurationStatus(): GoalsStatus {
    try {
      const metas = MetasService.carregar();
      const hasRevenue = metas.metaFaturamentoAnual > 0;
      const hasProfit = metas.metaLucroAnual > 0;
      
      return {
        hasConfiguredGoals: hasRevenue || hasProfit,
        hasRevenue,
        hasProfit,
        isComplete: hasRevenue && hasProfit && metas.margemLucroDesejada > 0
      };
    } catch {
      return {
        hasConfiguredGoals: false,
        hasRevenue: false,
        hasProfit: false,
        isComplete: false
      };
    }
  }

  /**
   * Obtém metas mensais baseadas nas configurações anuais (síncrono - localStorage)
   */
  static getMonthlyGoals(): MonthlyGoals {
    try {
      const metas = MetasService.carregar();
      
      return {
        revenue: metas.metaFaturamentoAnual / 12,
        profit: metas.metaLucroAnual / 12,
        profitMargin: metas.margemLucroDesejada
      };
    } catch {
      return {
        revenue: 0,
        profit: 0,
        profitMargin: 0
      };
    }
  }

  /**
   * Obtém metas mensais do Supabase com fallback para localStorage (assíncrono)
   */
  static async getMonthlyGoalsAsync(): Promise<MonthlyGoals> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        const { data, error } = await supabase
          .from('pricing_configuracoes')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle();

        if (!error && data) {
          const goals: MonthlyGoals = {
            revenue: (data.meta_faturamento_anual || 0) / 12,
            profit: (data.meta_lucro_anual || 0) / 12,
            profitMargin: data.margem_lucro_desejada || 0
          };

          // Sincronizar localStorage para acesso futuro rápido
          const metasForLocalStorage: MetasPrecificacao = {
            margemLucroDesejada: data.margem_lucro_desejada || 30,
            ano: data.ano_meta || new Date().getFullYear(),
            metaFaturamentoAnual: data.meta_faturamento_anual || 0,
            metaLucroAnual: data.meta_lucro_anual || 0
          };
          MetasService.salvar(metasForLocalStorage);

          return goals;
        }
      }
    } catch (error) {
      console.error('Erro ao buscar metas do Supabase:', error);
    }

    // Fallback para localStorage
    return this.getMonthlyGoals();
  }

  /**
   * Obtém metas anuais (síncrono - localStorage)
   */
  static getAnnualGoals(): AnnualGoals {
    try {
      const metas = MetasService.carregar();
      
      return {
        revenue: metas.metaFaturamentoAnual,
        profit: metas.metaLucroAnual,
        profitMargin: metas.margemLucroDesejada
      };
    } catch {
      return {
        revenue: 0,
        profit: 0,
        profitMargin: 0
      };
    }
  }

  /**
   * Obtém metas anuais do Supabase com fallback para localStorage (assíncrono)
   */
  static async getAnnualGoalsAsync(): Promise<AnnualGoals> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        const { data, error } = await supabase
          .from('pricing_configuracoes')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle();

        if (!error && data) {
          return {
            revenue: data.meta_faturamento_anual || 0,
            profit: data.meta_lucro_anual || 0,
            profitMargin: data.margem_lucro_desejada || 0
          };
        }
      }
    } catch (error) {
      console.error('Erro ao buscar metas anuais do Supabase:', error);
    }

    // Fallback para localStorage
    return this.getAnnualGoals();
  }

  /**
   * Obtém metas para um período específico (mês ou ano)
   */
  static getGoalsForPeriod(year: number, month?: number): MonthlyGoals {
    const annualGoals = this.getAnnualGoals();
    
    if (month) {
      // Retornar metas mensais
      return {
        revenue: annualGoals.revenue / 12,
        profit: annualGoals.profit / 12,
        profitMargin: annualGoals.profitMargin
      };
    }
    
    // Retornar metas anuais
    return {
      revenue: annualGoals.revenue,
      profit: annualGoals.profit,
      profitMargin: annualGoals.profitMargin
    };
  }

  /**
   * Calcula o progresso em relação às metas
   */
  static calculateProgress(actual: number, target: number): number {
    if (target === 0) return 0;
    return Math.min((actual / target) * 100, 100);
  }

  /**
   * Determina o status baseado no progresso
   */
  static getProgressStatus(progress: number): 'on-track' | 'behind' | 'ahead' {
    if (progress >= 100) return 'ahead';
    if (progress >= 90) return 'on-track';
    return 'behind';
  }

  /**
   * Obtém metas configuradas diretamente do serviço (síncrono - localStorage)
   */
  static getRawGoals(): MetasPrecificacao {
    return MetasService.carregar();
  }

  /**
   * URL para configuração de metas
   */
  static getConfigurationUrl(): string {
    return '/precificacao';
  }
}
