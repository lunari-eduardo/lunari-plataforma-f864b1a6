import { useState } from 'react';
import LeadsKanban from '@/components/leads/LeadsKanban';
import LeadMetricsCards from '@/components/leads/LeadMetricsCards';
import UnifiedLeadFilters from '@/components/leads/UnifiedLeadFilters';
import { useAppContext } from '@/contexts/AppContext';
import { useIsMobile } from '@/hooks/use-mobile';
import { Button } from '@/components/ui/button';
import { BarChart3, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { PeriodFilter, PeriodType } from '@/hooks/useLeadMetrics';

// Novo padrão: últimos 30 dias (foco no trabalho atual)
const getDefaultPeriodType = (): PeriodType => {
  return 'last_30_days';
};

export default function Leads() {
  const { origens } = useAppContext();
  const isMobile = useIsMobile();
  
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>({
    periodType: getDefaultPeriodType()
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [originFilter, setOriginFilter] = useState('all');
  const [showMetrics, setShowMetrics] = useState(!isMobile); // Hide metrics by default on mobile

  const handlePeriodChange = (periodType: PeriodType) => {
    setPeriodFilter({ periodType });
  };

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col bg-lunar-bg">
      {/* Mobile Metrics Toggle Button */}
      {isMobile && (
        <div className="flex-shrink-0 px-2 pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowMetrics(!showMetrics)}
            className="w-full justify-between text-sm font-medium border-lunar-border/60 hover:border-lunar-accent/50 transition-colors"
          >
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              <span>Métricas</span>
            </div>
            {showMetrics ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>
        </div>
      )}

      {/* Header e Métricas */}
      <div className={cn(
        "flex-shrink-0 px-2 space-y-2 transition-all duration-300",
        isMobile ? (showMetrics ? "pt-2 pb-1" : "pt-1") : "pt-3 space-y-3"
      )}>
        {/* Cards de Métricas - Conditionally shown */}
        {(!isMobile || showMetrics) && (
          <div className={cn(
            "transition-all duration-300",
            isMobile && showMetrics && "animate-in slide-in-from-top-2"
          )}>
            <LeadMetricsCards 
              periodFilter={periodFilter}
              isMobile={isMobile}
              isCollapsed={isMobile && !showMetrics}
            />
          </div>
        )}
        
        {/* Filtros Unificados */}
        <UnifiedLeadFilters
          periodType={periodFilter.periodType}
          onPeriodChange={handlePeriodChange}
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          originFilter={originFilter}
          onOriginChange={setOriginFilter}
          origins={origens}
          isMobile={isMobile}
        />
      </div>

      {/* Kanban - Dynamically sized based on visible elements */}
      <div className="flex-1 overflow-hidden min-h-0">
        <LeadsKanban 
          periodFilter={periodFilter}
          searchTerm={searchTerm}
          originFilter={originFilter}
          isMobile={isMobile}
        />
      </div>
    </div>
  );
}