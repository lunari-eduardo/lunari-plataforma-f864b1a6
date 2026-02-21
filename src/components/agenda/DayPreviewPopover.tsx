import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { UnifiedEvent } from '@/hooks/useUnifiedCalendar';
import { ChevronRight } from 'lucide-react';

interface DayPreviewPopoverProps {
  day: Date;
  events: UnifiedEvent[];
  onEventClick: (event: UnifiedEvent) => void;
  onViewDay: (date: Date) => void;
}

const getEventDotColor = (event: UnifiedEvent) => {
  if (event.type === 'appointment') {
    const origem = (event.originalData as any)?.origem;
    if (origem === 'orcamento') return 'bg-green-500';
    if (event.status === 'a confirmar') return 'bg-orange-500';
    return 'bg-blue-500';
  }
  return 'bg-muted-foreground';
};

export default function DayPreviewPopover({ day, events, onEventClick, onViewDay }: DayPreviewPopoverProps) {
  const dayLabel = format(day, "EEEE, d 'de' MMMM", { locale: ptBR });
  const capitalizedLabel = dayLabel.charAt(0).toUpperCase() + dayLabel.slice(1);

  return (
    <div className="w-64 rounded-xl border border-border bg-popover text-popover-foreground shadow-xl animate-in fade-in-0 zoom-in-95 duration-150">
      {/* Header */}
      <div className="px-3 py-2.5 border-b border-border/50">
        <p className="text-xs font-semibold text-foreground">{capitalizedLabel}</p>
        <p className="text-[10px] text-muted-foreground mt-0.5">
          {events.length} {events.length === 1 ? 'evento' : 'eventos'}
        </p>
      </div>

      {/* Events list */}
      <div className="max-h-48 overflow-y-auto py-1">
        {events.length === 0 ? (
          <p className="px-3 py-3 text-xs text-muted-foreground text-center">
            Nenhum evento neste dia
          </p>
        ) : (
          events.map(event => (
            <button
              key={event.id}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onEventClick(event);
              }}
              className="w-full px-3 py-1.5 flex items-start gap-2 hover:bg-accent/50 transition-colors text-left"
            >
              <span className={`mt-1.5 h-2 w-2 rounded-full flex-shrink-0 ${getEventDotColor(event)}`} />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-[11px] font-medium text-muted-foreground tabular-nums">
                    {event.time}
                  </span>
                  <span className="text-xs font-medium text-foreground truncate">
                    {event.client}
                  </span>
                </div>
                {event.description && (
                  <p className="text-[10px] text-muted-foreground truncate mt-0.5">
                    {event.description}
                  </p>
                )}
              </div>
            </button>
          ))
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-border/50">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onViewDay(day);
          }}
          className="w-full px-3 py-2 text-xs font-medium text-primary hover:bg-accent/50 transition-colors flex items-center justify-center gap-1"
        >
          Ver dia completo
          <ChevronRight className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}
