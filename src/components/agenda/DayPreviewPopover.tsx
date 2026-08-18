import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { UnifiedEvent } from '@/modules/agenda/presentation';
import { ChevronRight, Camera, Video, User, CheckSquare, FileText } from 'lucide-react';

interface DayPreviewPopoverProps {
  day: Date;
  events: UnifiedEvent[];
  onEventClick: (event: UnifiedEvent) => void;
  onViewDay: (date: Date) => void;
}

const getEventDotColor = (event: UnifiedEvent) => {
  const agendaType = event.agendaType || (event.originalData as any)?.agendaType || 'session';
  if (agendaType === 'personal') return 'bg-purple-500';
  if (agendaType === 'meeting') return 'bg-cyan-500';
  if (event.type === 'task' || agendaType === 'task') return 'bg-amber-500';

  if (event.type === 'appointment') {
    const origem = (event.originalData as any)?.origem;
    if (origem === 'orcamento') return 'bg-emerald-500';
    if (event.status === 'a confirmar') return 'bg-amber-500';
    return 'bg-blue-500';
  }
  return 'bg-muted-foreground';
};

const renderTypeIcon = (event: UnifiedEvent) => {
  const agendaType = event.agendaType || (event.originalData as any)?.agendaType || 'session';
  if (agendaType === 'personal') return <User className="h-3 w-3 text-purple-500 shrink-0" />;
  if (agendaType === 'meeting') return <Video className="h-3 w-3 text-cyan-500 shrink-0" />;
  if (event.type === 'task' || agendaType === 'task') return <CheckSquare className="h-3 w-3 text-amber-500 shrink-0" />;
  if ((event.originalData as any)?.origem === 'orcamento') return <FileText className="h-3 w-3 text-emerald-500 shrink-0" />;
  return <Camera className="h-3 w-3 text-blue-500 shrink-0" />;
};

export default function DayPreviewPopover({ day, events, onEventClick, onViewDay }: DayPreviewPopoverProps) {
  const dayLabel = format(day, "EEEE, d 'de' MMMM", { locale: ptBR });
  const capitalizedLabel = dayLabel.charAt(0).toUpperCase() + dayLabel.slice(1);

  return (
    <div className="w-72 rounded-xl border border-border/40 bg-popover text-popover-foreground shadow-xl animate-in fade-in-0 zoom-in-95 duration-150 backdrop-blur-md">
      {/* Header */}
      <div className="px-3.5 py-2.5 border-b border-border/30 bg-muted/20">
        <p className="text-xs font-semibold text-foreground">{capitalizedLabel}</p>
        <p className="text-[11px] text-muted-foreground mt-0.5">
          {events.length} {events.length === 1 ? 'compromisso agendado' : 'compromissos agendados'}
        </p>
      </div>

      {/* Events list */}
      <div className="max-h-56 overflow-y-auto py-1 scrollbar-thin">
        {events.length === 0 ? (
          <p className="px-3 py-4 text-xs text-muted-foreground text-center">
            Nenhum evento neste dia
          </p>
        ) : (
          events.map(event => {
            const agendaType = event.agendaType || (event.originalData as any)?.agendaType || 'session';
            const mainTitle = agendaType === 'personal' ? event.title : (event.client || event.title);
            const subLabel =
              agendaType === 'personal'
                ? (event.description || 'Evento pessoal')
                : agendaType === 'meeting'
                ? (event.originalData?.location ? `Reunião • ${event.originalData.location}` : 'Reunião')
                : (event.description || (event.originalData as any)?.type || 'Sessão');

            return (
              <button
                key={event.id}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onEventClick(event);
                }}
                className="w-full px-3 py-2 flex items-start gap-2.5 hover:bg-muted/40 dark:hover:bg-white/5 rounded-lg transition-colors text-left group"
              >
                <div className="mt-0.5 flex items-center gap-1.5 shrink-0">
                  <span className={`h-2 w-2 rounded-full ${getEventDotColor(event)}`} />
                  {renderTypeIcon(event)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-1">
                    <span className="text-xs font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                      {mainTitle}
                    </span>
                    <span className="text-[11px] font-medium text-muted-foreground tabular-nums shrink-0">
                      {event.time}
                    </span>
                  </div>
                  {subLabel && (
                    <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                      {subLabel}
                    </p>
                  )}
                </div>
              </button>
            );
          })
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-border/30 bg-muted/10 p-1">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onViewDay(day);
          }}
          className="w-full px-3 py-2 text-xs font-semibold text-primary hover:bg-primary/5 dark:hover:bg-primary/15 rounded-lg transition-colors flex items-center justify-center gap-1.5"
        >
          Ver dia completo
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
