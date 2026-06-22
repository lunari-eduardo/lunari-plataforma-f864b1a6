import { useMemo } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { TrendingUp } from 'lucide-react';
import { formatCurrency } from '@/utils/currencyUtils';
import { summarizeRevenue, getWeekRange } from '@/utils/agendaRevenueCalc';
import { useConfigurationContext } from '@/contexts/ConfigurationContext';
import type { UnifiedEvent } from '@/modules/agenda/presentation';

interface DayRevenueKPIProps {
  date: Date;
  unifiedEvents: UnifiedEvent[];
  range: 'day' | 'week';
}

export default function DayRevenueKPI({ date, unifiedEvents, range }: DayRevenueKPIProps) {
  const { pacotes } = useConfigurationContext();

  const summary = useMemo(() => {
    if (range === 'week') {
      return summarizeRevenue(unifiedEvents, pacotes, getWeekRange(date));
    }
    return summarizeRevenue(unifiedEvents, pacotes, { start: date });
  }, [unifiedEvents, pacotes, date, range]);

  const title = range === 'week' ? 'Faturamento da semana' : 'Faturamento do dia';
  const subtitle =
    range === 'week'
      ? `Semana de ${format(date, "d 'de' MMM", { locale: ptBR })}`
      : format(date, "EEEE, d 'de' MMMM", { locale: ptBR });

  return (
    <div className="rounded-lg border border-white/30 dark:border-white/10 bg-card/40 dark:bg-card/[0.05] backdrop-blur-sm p-3 space-y-2">
      <div>
        <div className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
          <TrendingUp className="h-3 w-3" />
          {title}
        </div>
        <div className="text-[10px] text-muted-foreground/80 capitalize mt-0.5">{subtitle}</div>
      </div>

      <div>
        <div className="text-xl font-semibold tabular-nums leading-tight">
          {formatCurrency(summary.total)}
        </div>
        <div className="text-[11px] text-muted-foreground mt-0.5">
          {summary.count === 0
            ? 'Nenhuma sessão'
            : `${summary.count} ${summary.count === 1 ? 'sessão' : 'sessões'}`}
        </div>
      </div>
    </div>
  );
}
