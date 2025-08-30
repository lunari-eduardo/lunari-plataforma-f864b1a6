import { useMemo } from 'react';
import { useLeads } from './useLeads';
import { getLossReasons } from '@/config/motivosPerda';
import type { Lead } from '@/types/leads';

export interface LeadMetrics {
  totalLeads: number;
  leadsEnviados: number;
  leadsFechados: number;
  leadsPerdidos: number;
  taxaConversao: number;
  topMotivoPerda: string | null;
}

export type PeriodType = 
  | 'current_year'
  | 'last_7_days' | 'last_30_days' | 'last_90_days'
  | 'january_2025' | 'february_2025' | 'march_2025' | 'april_2025'
  | 'may_2025' | 'june_2025' | 'july_2025' | 'august_2025'
  | 'september_2025' | 'october_2025' | 'november_2025' | 'december_2025'
  | 'previous_year'
  | 'archived' | 'all_active' | 'all_time';

export interface PeriodFilter {
  periodType: PeriodType;
}

const convertPeriodTypeToFilter = (periodType: PeriodType) => {
  const currentYear = new Date().getFullYear();
  const now = new Date();
  
  switch (periodType) {
    case 'current_year':
      return { year: currentYear, month: undefined, type: 'year' };
    case 'last_7_days':
      const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      return { dateFrom: last7Days, type: 'range' };
    case 'last_30_days':
      const last30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      return { dateFrom: last30Days, type: 'range' };
    case 'last_90_days':
      const last90Days = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      return { dateFrom: last90Days, type: 'range' };
    case 'january_2025': return { year: 2025, month: 1, type: 'month' };
    case 'february_2025': return { year: 2025, month: 2, type: 'month' };
    case 'march_2025': return { year: 2025, month: 3, type: 'month' };
    case 'april_2025': return { year: 2025, month: 4, type: 'month' };
    case 'may_2025': return { year: 2025, month: 5, type: 'month' };
    case 'june_2025': return { year: 2025, month: 6, type: 'month' };
    case 'july_2025': return { year: 2025, month: 7, type: 'month' };
    case 'august_2025': return { year: 2025, month: 8, type: 'month' };
    case 'september_2025': return { year: 2025, month: 9, type: 'month' };
    case 'october_2025': return { year: 2025, month: 10, type: 'month' };
    case 'november_2025': return { year: 2025, month: 11, type: 'month' };
    case 'december_2025': return { year: 2025, month: 12, type: 'month' };
    case 'previous_year':
      return { year: currentYear - 1, month: undefined, type: 'year' };
    case 'archived':
      return { type: 'archived' };
    case 'all_active':
      return { type: 'active' };
    case 'all_time':
    default:
      return { type: 'all' };
  }
};

export function useLeadMetrics(periodFilter?: PeriodFilter) {
  const { leads } = useLeads();
  const lossReasons = getLossReasons();

  const filteredLeads = useMemo(() => {
    if (!periodFilter) {
      // Default to last 30 days, non-archived leads
      const last30Days = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      return leads.filter(lead => {
        const leadDate = new Date(lead.dataCriacao);
        return !lead.arquivado && leadDate >= last30Days;
      });
    }

    const filter = convertPeriodTypeToFilter(periodFilter.periodType);
    
    return leads.filter(lead => {
      const leadDate = new Date(lead.dataCriacao);
      
      switch (filter.type) {
        case 'range':
          return !lead.arquivado && leadDate >= filter.dateFrom!;
        case 'year':
          const leadYear = leadDate.getFullYear();
          return !lead.arquivado && (filter.year ? leadYear === filter.year : true);
        case 'month':
          const leadMonth = leadDate.getMonth() + 1;
          const leadYear2 = leadDate.getFullYear();
          return !lead.arquivado && leadMonth === filter.month && leadYear2 === filter.year;
        case 'archived':
          return lead.arquivado === true;
        case 'active':
          return !lead.arquivado;
        case 'all':
        default:
          return true; // all_time includes archived
      }
    });
  }, [leads, periodFilter]);

  const metrics = useMemo<LeadMetrics>(() => {
    const totalLeads = filteredLeads.length;

    // Contar leads que passaram por cada status baseado no histórico
    const leadsEnviados = filteredLeads.filter(lead => {
      // Verificar se já passou por "orcamento_enviado" no histórico ou está atualmente
      return lead.status === 'orcamento_enviado' || 
             (lead.historicoStatus?.some(h => h.status === 'orcamento_enviado') ?? false);
    }).length;

    const leadsFechados = filteredLeads.filter(lead => {
      // Verificar se já passou por "fechado" no histórico ou está atualmente
      return lead.status === 'fechado' || 
             (lead.historicoStatus?.some(h => h.status === 'fechado') ?? false);
    }).length;

    const leadsPerdidos = filteredLeads.filter(lead => {
      // Verificar se está atualmente perdido ou passou por "perdido"
      return lead.status === 'perdido' || 
             (lead.historicoStatus?.some(h => h.status === 'perdido') ?? false);
    }).length;

    // Taxa de conversão: fechados ÷ enviados
    const taxaConversao = leadsEnviados > 0 ? Math.round((leadsFechados / leadsEnviados) * 100) : 0;

    // Top motivo de perda
    const motivosCount: Record<string, number> = {};
    filteredLeads
      .filter(lead => lead.status === 'perdido' && lead.motivoPerda)
      .forEach(lead => {
        const motivo = lead.motivoPerda!;
        motivosCount[motivo] = (motivosCount[motivo] || 0) + 1;
      });

    const topMotivoPerda = Object.keys(motivosCount).length > 0
      ? Object.entries(motivosCount)
          .sort(([, a], [, b]) => b - a)[0]?.[0] || null
      : null;

    return {
      totalLeads,
      leadsEnviados,
      leadsFechados,
      leadsPerdidos,
      taxaConversao,
      topMotivoPerda
    };
  }, [filteredLeads]);

  const topMotivoLabel = useMemo(() => {
    if (!metrics.topMotivoPerda) return null;
    const reason = lossReasons.find(r => r.id === metrics.topMotivoPerda);
    return reason?.label || metrics.topMotivoPerda;
  }, [metrics.topMotivoPerda, lossReasons]);

  return {
    metrics,
    topMotivoLabel,
    hasData: filteredLeads.length > 0
  };
}