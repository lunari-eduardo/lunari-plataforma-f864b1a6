import { useState } from 'react';
import LeadsKanban from '@/components/leads/LeadsKanban';
import LeadMetricsCards from '@/components/leads/LeadMetricsCards';
import LeadPeriodFilter from '@/components/leads/LeadPeriodFilter';
import type { PeriodFilter, PeriodType } from '@/hooks/useLeadMetrics';

const getCurrentMonthPeriodType = (): PeriodType => {
  const now = new Date();
  const currentMonth = now.getMonth() + 1; // getMonth() returns 0-11
  const currentYear = now.getFullYear();
  
  if (currentYear === 2025) {
    const monthMap: Record<number, PeriodType> = {
      1: 'january_2025',
      2: 'february_2025', 
      3: 'march_2025',
      4: 'april_2025',
      5: 'may_2025',
      6: 'june_2025',
      7: 'july_2025',
      8: 'august_2025',
      9: 'september_2025',
      10: 'october_2025',
      11: 'november_2025',
      12: 'december_2025'
    };
    return monthMap[currentMonth] || 'current_year';
  }
  
  return 'current_year';
};

export default function Leads() {
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>({
    periodType: getCurrentMonthPeriodType()
  });

  const handlePeriodChange = (periodType: PeriodType) => {
    setPeriodFilter({ periodType });
  };

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col bg-lunar-bg">
      {/* Header e Métricas */}
      <div className="flex-shrink-0 px-2 pt-3 space-y-3">
        {/* Cards de Métricas */}
        <LeadMetricsCards periodFilter={periodFilter} />
        
        {/* Filtro de Período */}
        <LeadPeriodFilter
          periodType={periodFilter.periodType}
          onPeriodChange={handlePeriodChange}
        />
      </div>

      {/* Kanban - Ajustado para ocupar espaço restante */}
      <div className="flex-1 overflow-hidden">
        <LeadsKanban periodFilter={periodFilter} />
      </div>
    </div>
  );
}