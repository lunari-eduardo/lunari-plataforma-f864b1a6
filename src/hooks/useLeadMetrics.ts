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

export interface PeriodFilter {
  month?: number; // 1-12
  year?: number;
  dateType: 'criacao' | 'atualizacao';
}

export function useLeadMetrics(periodFilter?: PeriodFilter) {
  const { leads } = useLeads();
  const lossReasons = getLossReasons();

  const filteredLeads = useMemo(() => {
    if (!periodFilter?.month || !periodFilter?.year) {
      return leads;
    }

    return leads.filter(lead => {
      const dateToCheck = periodFilter.dateType === 'criacao' 
        ? lead.dataCriacao 
        : lead.dataAtualizacao || lead.dataCriacao;
      
      const date = new Date(dateToCheck);
      const leadMonth = date.getMonth() + 1; // getMonth() retorna 0-11
      const leadYear = date.getFullYear();
      
      return leadMonth === periodFilter.month && leadYear === periodFilter.year;
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