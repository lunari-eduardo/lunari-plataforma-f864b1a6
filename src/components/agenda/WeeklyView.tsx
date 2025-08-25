import React from 'react';
import { startOfWeek, addDays, format, isSameDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { UnifiedEvent } from '@/hooks/useUnifiedCalendar';
import UnifiedEventCard from './UnifiedEventCard';
import { useAvailability } from '@/hooks/useAvailability';
import { useIsMobile } from '@/hooks/use-mobile';
import { useIsTablet } from '@/hooks/useIsTablet';
import { Button } from '@/components/ui/button';
import { Share2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
interface WeeklyViewProps {
  date: Date;
  unifiedEvents: UnifiedEvent[];
  onCreateSlot: (slot: {
    date: Date;
    time: string;
  }) => void;
  onEventClick: (event: UnifiedEvent) => void;
}
export default function WeeklyView({
  date,
  unifiedEvents,
  onCreateSlot,
  onEventClick
}: WeeklyViewProps) {
  const {
    availability,
    deleteAvailabilitySlot
  } = useAvailability();
  const weekStart = startOfWeek(date);
  const timeSlots = ["08:00", "09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00", "18:00"];
  const weekDays = Array.from({
    length: 7
  }, (_, i) => addDays(weekStart, i));
  const isMobile = useIsMobile();
  const isTablet = useIsTablet();
  const formatDayName = (date: Date) => {
    return format(date, 'EEE', {
      locale: ptBR
    });
  };
  const getEventForSlot = (day: Date, time: string) => {
    return unifiedEvents.find(event => isSameDay(event.date, day) && event.time === time && event.type === 'appointment');
  };
  const getAvailabilityForSlot = (day: Date, time: string) => {
    const ds = format(day, 'yyyy-MM-dd');
    // Não considerar disponibilidade se houver agendamento no mesmo horário
    const hasAppointment = unifiedEvents.some(e => isSameDay(e.date, day) && e.time === time && e.type === 'appointment');
    if (hasAppointment) return null;
    return availability.find(a => a.date === ds && a.time === time);
  };
  const formatTimeBr = (t: string) => {
    const [hh, mm] = t.split(':');
    return mm === '00' ? `${hh}h` : `${hh}h ${mm}min`;
  };
  const getDayCounts = (day: Date) => {
    const dayAppointments = unifiedEvents.filter(e => isSameDay(e.date, day) && e.type === 'appointment');
    const takenTimes = new Set(dayAppointments.map(e => e.time));
    const ds = format(day, 'yyyy-MM-dd');
    const availCount = new Set(availability.filter(a => a.date === ds && !takenTimes.has(a.time)).map(a => a.time)).size;
    return {
      sessionsCount: dayAppointments.length,
      availCount
    };
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
      const slots = availability.filter(a => a.date === ds).map(a => a.time).sort();
      if (slots.length > 0) {
        const dateStr = format(day, "dd 'de' MMMM", {
          locale: ptBR
        });
        const weekdayStr = format(day, 'eeee', {
          locale: ptBR
        });
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
        await navigator.share({
          title: 'Horários da semana',
          text
        });
      } else {
        await navigator.clipboard.writeText(text);
        toast.success('Horários da semana copiados');
      }
    } catch {
      await navigator.clipboard.writeText(text);
      toast.success('Horários da semana copiados');
    }
  };
  return <div className={`pb-4 scrollbar-elegant ${isMobile ? 'overflow-x-auto' : ''}`}>
      <div className={`${isMobile ? 'min-w-[960px]' : 'w-full'}`}>
        <div className="flex items-center justify-between mb-2">
          
          <Button variant="ghost" size="icon" onClick={handleShareWeek} aria-label="Compartilhar horários da semana" title="Compartilhar horários da semana">
            <Share2 className="h-4 w-4" />
          </Button>
        </div>
        <div className="grid grid-cols-8 gap-px bg-border">
          {/* First cell empty - for time labels */}
          <div className="bg-muted"></div>
          
          {/* Day headers */}
          {weekDays.map((day, index) => <div key={index} className={`text-center bg-muted ${isTablet ? 'p-1' : 'p-1 md:p-2'}`}>
              <p className={`text-muted-foreground font-medium ${isTablet ? 'text-[10px]' : 'text-xs'}`}>{formatDayName(day)}</p>
              <p className={`font-semibold ${isTablet ? 'text-xs' : 'text-xs md:text-sm'}`}>{format(day, 'd')}</p>
              {/* Mobile: dots with counts */}
              {(() => {
            if (!isMobile) return null;
            const {
              sessionsCount,
              availCount
            } = getDayCounts(day);
            return <div className="mt-0.5 flex items-center justify-center gap-2 md:hidden">
                    {sessionsCount > 0 && <span className="inline-flex items-center gap-1 text-[10px]">
                        <span className="h-2.5 w-2.5 rounded-full bg-primary" aria-hidden></span>
                        {sessionsCount}
                      </span>}
                    {availCount > 0 && <span className="inline-flex items-center gap-1 text-[10px]">
                        <span className="h-2.5 w-2.5 rounded-full bg-availability" aria-hidden></span>
                        {availCount}
                      </span>}
                  </div>;
          })()}
            </div>)}
          
          {/* Time slots */}
          {timeSlots.map(time => <React.Fragment key={time}>
              {/* Time label */}
              <div className={`flex items-center justify-end text-muted-foreground rounded-sm bg-muted ${isTablet ? 'h-10 text-[10px] px-2' : 'h-12 md:h-16 text-xs px-3 md:px-4'}`}>
                {time}
              </div>
              
              {/* Time slots for each day */}
              {weekDays.map((day, dayIndex) => {
            const event = getEventForSlot(day, time);
            return <div key={`${dayIndex}-${time}`} onClick={() => !event && onCreateSlot({
              date: day,
              time
            })} className={`relative cursor-pointer bg-card hover:bg-muted ${isTablet ? 'h-10 p-0.5' : 'h-12 md:h-16 p-0.5 md:p-1'}`}>
                      {event ? !isMobile && <div onClick={e => e.stopPropagation()}>
                          <UnifiedEventCard event={event} onClick={onEventClick} variant="weekly" />
                        </div> : !isMobile && (() => {
                          const slot = getAvailabilityForSlot(day, time);
                          return slot ? <div className={`absolute inset-0 flex items-center justify-center ${isTablet ? 'gap-1' : 'gap-2'}`}>
                            <span 
                              className={`rounded text-lunar-text border ${isTablet ? 'text-[8px] px-1 py-0.5' : 'text-[10px] px-1.5 py-0.5'}`}
                              style={{ 
                                backgroundColor: slot.color ? `${slot.color}20` : 'hsl(var(--availability) / 0.2)',
                                borderColor: slot.color ? `${slot.color}80` : 'hsl(var(--availability) / 0.5)'
                              }}
                            >
                              {slot.label || 'Disponível'}
                            </span>
                          <button type="button" onClick={e => {
                  e.stopPropagation();
                  handleRemoveAvailability(day, time);
                }} className={`text-muted-foreground hover:text-foreground items-center gap-1 ${isTablet ? 'text-[8px] inline-flex' : 'text-[10px] hidden lg:inline-flex'}`} aria-label="Remover disponibilidade" title="Remover disponibilidade">
                            <Trash2 className={isTablet ? 'h-2.5 w-2.5' : 'h-3 w-3'} /> {!isTablet && 'Remover'}
                          </button>
                        </div> : null}
                  </div>;
          })}
            </React.Fragment>)}
        </div>
      </div>
    </div>;
}