import { useState } from 'react';
import LeadsKanban from '@/components/leads/LeadsKanban';
import LeadMetricsCards from '@/components/leads/LeadMetricsCards';
import LeadPeriodFilter from '@/components/leads/LeadPeriodFilter';
import type { PeriodFilter } from '@/hooks/useLeadMetrics';

export default function Leads() {
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>({
    dateType: 'criacao'
  });

  const handleMonthChange = (month?: number) => {
    setPeriodFilter(prev => ({ ...prev, month }));
  };

  const handleYearChange = (year?: number) => {
    setPeriodFilter(prev => ({ ...prev, year }));
  };

  const handleDateTypeChange = (dateType: 'criacao' | 'atualizacao') => {
    setPeriodFilter(prev => ({ ...prev, dateType }));
  };

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col bg-lunar-bg">
      {/* Header e Métricas */}
      <div className="flex-shrink-0 px-2 pt-3 space-y-3">
        {/* Cards de Métricas */}
        <LeadMetricsCards periodFilter={periodFilter} />
        
        {/* Filtro de Período */}
        <LeadPeriodFilter
          selectedMonth={periodFilter.month}
          selectedYear={periodFilter.year}
          dateType={periodFilter.dateType}
          onMonthChange={handleMonthChange}
          onYearChange={handleYearChange}
          onDateTypeChange={handleDateTypeChange}
        />
      </div>

      {/* Kanban - Ajustado para ocupar espaço restante */}
      <div className="flex-1 overflow-hidden">
        <LeadsKanban periodFilter={periodFilter} />
      </div>
    </div>
  );
}