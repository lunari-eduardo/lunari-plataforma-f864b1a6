import MiniMonthCalendar from './MiniMonthCalendar';
import DayRevenueKPI from './DayRevenueKPI';
import AgendaLegend from './AgendaLegend';
import { useAvailability } from '@/hooks/useAvailability';
import type { UnifiedEvent } from '@/hooks/useUnifiedCalendar';
import type { ViewType } from '@/utils/dateFormatters';

interface AgendaSidebarProps {
  date: Date;
  view: ViewType;
  unifiedEvents: UnifiedEvent[];
  onNavigateToDate: (date: Date) => void;
  onSwitchToDay?: () => void;
}

export default function AgendaSidebar({
  date,
  view,
  unifiedEvents,
  onNavigateToDate,
  onSwitchToDay,
}: AgendaSidebarProps) {
  const { availability } = useAvailability();

  const showKPI = view === 'day' || view === 'week';
  const kpiRange = view === 'week' ? 'week' : 'day';

  return (
    <aside className="space-y-3">
      <div className="rounded-lg border border-white/30 dark:border-white/10 bg-card/40 dark:bg-card/[0.05] backdrop-blur-sm p-3">
        <MiniMonthCalendar
          selectedDate={date}
          unifiedEvents={unifiedEvents}
          availability={availability}
          onDateSelect={(d) => {
            onNavigateToDate(d);
            if (view !== 'day' && view !== 'week') onSwitchToDay?.();
          }}
        />
      </div>

      {showKPI && (
        <DayRevenueKPI date={date} unifiedEvents={unifiedEvents} range={kpiRange} />
      )}

      <AgendaLegend />
    </aside>
  );
}
