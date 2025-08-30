import type { PeriodType } from '@/hooks/useLeadMetrics';
import type { Lead } from '@/types/leads';

/**
 * Utilitário centralizado para filtros de leads
 * Consolida toda a lógica de filtragem temporal e por status
 */

export interface FilterResult {
  year?: number;
  month?: number;
  dateFrom?: Date;
  type: 'year' | 'month' | 'range' | 'archived' | 'active' | 'all';
}

export function convertPeriodTypeToFilter(periodType: PeriodType): FilterResult {
  const currentYear = new Date().getFullYear();
  const now = new Date();
  
  switch (periodType) {
    case 'current_year':
      return { year: currentYear, month: undefined, type: 'year' };
    case 'last_7_days':
      return { 
        dateFrom: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000), 
        type: 'range' 
      };
    case 'last_30_days':
      return { 
        dateFrom: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000), 
        type: 'range' 
      };
    case 'last_90_days':
      return { 
        dateFrom: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000), 
        type: 'range' 
      };
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
}

/**
 * Aplica filtro temporal e de arquivamento aos leads
 */
export function filterLeadsByPeriod(leads: Lead[], filter: FilterResult): Lead[] {
  return leads.filter(lead => {
    const leadDate = new Date(lead.dataCriacao);
    
    // Validação robusta de data
    if (isNaN(leadDate.getTime())) {
      console.warn(`📅 [LeadFilters] Data inválida para lead ${lead.id}:`, lead.dataCriacao);
      return false;
    }
    
    switch (filter.type) {
      case 'range':
        if (!filter.dateFrom) return false;
        return !lead.arquivado && leadDate >= filter.dateFrom;
      case 'year':
        const leadYear = leadDate.getFullYear();
        return !lead.arquivado && (filter.year ? leadYear === filter.year : true);
      case 'month':
        if (!filter.year || !filter.month) return false;
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
}

/**
 * Obtém timestamp válido para validações de data
 * Usa statusTimestamp se disponível, senão dataCriacao como fallback
 */
export function getValidTimestamp(lead: Lead): Date {
  if (lead.statusTimestamp) {
    const statusDate = new Date(lead.statusTimestamp);
    if (!isNaN(statusDate.getTime())) {
      return statusDate;
    }
  }
  
  // Fallback para dataCriacao
  const creationDate = new Date(lead.dataCriacao);
  if (!isNaN(creationDate.getTime())) {
    return creationDate;
  }
  
  // Último fallback - data atual
  console.warn(`⚠️ [LeadFilters] Usando data atual como fallback para lead ${lead.id}`);
  return new Date();
}