import { useMemo } from 'react';
import { useLeads } from './useLeads';
import { getLossReasons } from '@/config/motivosPerda';
import { convertPeriodTypeToFilter, filterLeadsByPeriod } from '@/utils/leadFilters';
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


export function useLeadMetrics(periodFilter?: PeriodFilter) {
  const { leads } = useLeads();
  const lossReasons = getLossReasons();

  const filteredLeads = useMemo(() => {
    if (!periodFilter) {
      // Default to last 30 days, non-archived leads
      const defaultFilter = convertPeriodTypeToFilter('last_30_days');
      return filterLeadsByPeriod(leads, defaultFilter);
    }

    const filter = convertPeriodTypeToFilter(periodFilter.periodType);
    return filterLeadsByPeriod(leads, filter);
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

    // Top motivo de perda - considerar histórico completo
    const motivosCount: Record<string, number> = {};
    filteredLeads
      .filter(lead => {
        // Lead está perdido OU já passou por perdido no histórico
        return (lead.status === 'perdido' || 
                lead.historicoStatus?.some(h => h.status === 'perdido')) && 
               lead.motivoPerda;
      })
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