import React from 'react';
import { startOfWeek, addDays, format, isSameDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { UnifiedEvent } from '@/hooks/useUnifiedCalendar';
import UnifiedEventCard from './UnifiedEventCard';
import { useAvailability } from '@/hooks/useAvailability';
import { Button } from '@/components/ui/button';
import { Share2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
interface WeeklyViewProps {
  date: Date;
  unifiedEvents: UnifiedEvent[];
  onCreateSlot: (slot: { date: Date; time: string }) => void;
  onEventClick: (event: UnifiedEvent) => void;
}

export default function WeeklyView({
  date,
  unifiedEvents,
  onCreateSlot,
  onEventClick
}: WeeklyViewProps) {
  const { availability, deleteAvailabilitySlot } = useAvailability();
  const weekStart = startOfWeek(date);
  const timeSlots = ["08:00", "09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00", "18:00"];
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const formatDayName = (date: Date) => {
    return format(date, 'EEE', { locale: ptBR });
  };

const getEventForSlot = (day: Date, time: string) => {
    return unifiedEvents.find(event => 
      isSameDay(event.date, day) && event.time === time
    );
  };
  const hasAvailabilityForSlot = (day: Date, time: string) => {
    const ds = format(day, 'yyyy-MM-dd');
    return availability.some(a => a.date === ds && a.time === time);
  };

  const formatTimeBr = (t: string) => {
    const [hh, mm] = t.split(':');
    return mm === '00' ? `${hh}h` : `${hh}h ${mm}min`;
  };

  const handleRemoveAvailability = (day: Date, time: string) => {
    const ds = format(day, 'yyyy-MM-dd');
    const matches = availability.filter(a => a.date === ds && a.time === time);
    matches.forEach(a => deleteAvailabilitySlot(a.id));
    if (matches.length > 0) {
      toast.success('Disponibilidade removida');
    }
  };
  const handleShareWeek = async () => {
    const sections: string[] = [];
    for (const day of weekDays) {
      const ds = format(day, 'yyyy-MM-dd');
      const slots = availability
        .filter(a => a.date === ds)
        .map(a => a.time)
        .sort();
      if (slots.length > 0) {
        const dateStr = format(day, "dd 'de' MMMM", { locale: ptBR });
        const weekdayStr = format(day, 'eeee', { locale: ptBR });
        const times = slots.map(formatTimeBr).join('\n');
        sections.push(`No dia ${dateStr}, ${weekdayStr}, tenho os seguintes horários:\n\n${times}`);
      }
    }
    if (sections.length === 0) {
      toast.error('Não há disponibilidades nesta semana.');
      return;
    }
    const text = sections.join('\n\n') + '\n\nQual fica melhor para você?';
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Horários da semana', text });
      } else {
        await navigator.clipboard.writeText(text);
        toast.success('Horários da semana copiados');
      }
    } catch {
      await navigator.clipboard.writeText(text);
      toast.success('Horários da semana copiados');
    }
  };

  return (
    <div className="overflow-x-auto pb-4">
      <div className="min-w-[300px] md:min-w-[700px]">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs md:text-sm text-muted-foreground">Semana de {format(weekStart, "dd 'de' MMMM", { locale: ptBR })}</p>
          <Button variant="ghost" size="icon" onClick={handleShareWeek} aria-label="Compartilhar horários da semana" title="Compartilhar horários da semana">
            <Share2 className="h-4 w-4" />
          </Button>
        </div>
        <div className="grid grid-cols-8 gap-px bg-border">
          {/* First cell empty - for time labels */}
          <div className="bg-stone-200"></div>
          
          {/* Day headers */}
          {weekDays.map((day, index) => (
            <div key={index} className="p-1 md:p-2 text-center bg-stone-200">
              <p className="text-xs text-muted-foreground font-medium">{formatDayName(day)}</p>
              <p className="font-semibold text-xs md:text-sm">{format(day, 'd')}</p>
            </div>
          ))}
          
          {/* Time slots */}
          {timeSlots.map(time => (
            <React.Fragment key={time}>
              {/* Time label */}
              <div className="p-1 md:p-2 text-right text-xs text-muted-foreground px-2 md:px-3 py-2 md:py-3 rounded-sm my-px bg-muted">
                {time}
              </div>
              
              {/* Time slots for each day */}
              {weekDays.map((day, dayIndex) => {
                const event = getEventForSlot(day, time);
                return (
                  <div 
                    key={`${dayIndex}-${time}`} 
                    onClick={() => !event && onCreateSlot({ date: day, time })} 
                    className="border h-8 md:h-10 p-0.5 md:p-1 relative cursor-pointer bg-stone-100 hover:bg-stone-50 border-gray-100"
                  >
                    {event ? (
                      <div onClick={(e) => e.stopPropagation()}>
                        <UnifiedEventCard 
                          event={event} 
                          onClick={onEventClick}
                          variant="weekly"
                        />
                      </div>
                    ) : (
                      hasAvailabilityForSlot(day, time) ? (
                          <div className="absolute inset-0 flex items-center justify-center gap-2">
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-availability/20 border border-availability/50 text-lunar-text">Disponível</span>
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); handleRemoveAvailability(day, time); }}
                              className="text-[10px] text-muted-foreground hover:text-foreground hidden lg:inline-flex items-center gap-1"
                              aria-label="Remover disponibilidade"
                              title="Remover disponibilidade"
                            >
                              <Trash2 className="h-3 w-3" /> Remover
                            </button>
                          </div>
                      ) : null
                    )}
                  </div>
                );
              })}
            </React.Fragment>
          ))}
        </div>
      </div>
    </div>
  );
}
