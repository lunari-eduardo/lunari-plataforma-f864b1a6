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
  | 'january_2025' | 'february_2025' | 'march_2025' | 'april_2025'
  | 'may_2025' | 'june_2025' | 'july_2025' | 'august_2025'
  | 'september_2025' | 'october_2025' | 'november_2025' | 'december_2025'
  | 'previous_year'
  | 'all_time';

export interface PeriodFilter {
  periodType: PeriodType;
}

const convertPeriodTypeToFilter = (periodType: PeriodType) => {
  const currentYear = new Date().getFullYear();
  
  switch (periodType) {
    case 'current_year':
      return { year: currentYear, month: undefined };
    case 'january_2025': return { year: 2025, month: 1 };
    case 'february_2025': return { year: 2025, month: 2 };
    case 'march_2025': return { year: 2025, month: 3 };
    case 'april_2025': return { year: 2025, month: 4 };
    case 'may_2025': return { year: 2025, month: 5 };
    case 'june_2025': return { year: 2025, month: 6 };
    case 'july_2025': return { year: 2025, month: 7 };
    case 'august_2025': return { year: 2025, month: 8 };
    case 'september_2025': return { year: 2025, month: 9 };
    case 'october_2025': return { year: 2025, month: 10 };
    case 'november_2025': return { year: 2025, month: 11 };
    case 'december_2025': return { year: 2025, month: 12 };
    case 'previous_year':
      return { year: currentYear - 1, month: undefined };
    case 'all_time':
    default:
      return { year: undefined, month: undefined };
  }
};

export function useLeadMetrics(periodFilter?: PeriodFilter) {
  const { leads } = useLeads();
  const lossReasons = getLossReasons();

  const filteredLeads = useMemo(() => {
    if (!periodFilter) {
      // Default to current month
      const now = new Date();
      const currentMonth = now.getMonth() + 1;
      const currentYear = now.getFullYear();
      
      return leads.filter(lead => {
        const date = new Date(lead.dataCriacao);
        const leadMonth = date.getMonth() + 1;
        const leadYear = date.getFullYear();
        return leadMonth === currentMonth && leadYear === currentYear;
      });
    }

    const { year, month } = convertPeriodTypeToFilter(periodFilter.periodType);
    
    if (!year && !month) {
      return leads; // all_time
    }

    return leads.filter(lead => {
      const date = new Date(lead.dataCriacao);
      const leadMonth = date.getMonth() + 1;
      const leadYear = date.getFullYear();
      
      if (year && month) {
        return leadMonth === month && leadYear === year;
      } else if (year) {
        return leadYear === year;
      }
      return true;
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