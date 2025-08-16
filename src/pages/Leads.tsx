import { useState } from 'react';
import LeadsKanban from '@/components/leads/LeadsKanban';
import LeadMetricsCards from '@/components/leads/LeadMetricsCards';
import LeadPeriodFilter from '@/components/leads/LeadPeriodFilter';
import type { PeriodFilter, PeriodType } from '@/hooks/useLeadMetrics';

export default function Leads() {
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>({
    periodType: 'current_year'
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