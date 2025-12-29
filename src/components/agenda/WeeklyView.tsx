import React, { useMemo } from 'react';
import { format, isSameDay, startOfWeek, addDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { UnifiedEvent } from '@/hooks/useUnifiedCalendar';
import UnifiedEventCard from './UnifiedEventCard';
import { useAvailability } from '@/hooks/useAvailability';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';
import { Button } from '@/components/ui/button';
import { Share2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { formatTimeBr, formatDayName } from '@/utils/agendaUtils';
import { cn } from '@/lib/utils';
interface WeeklyViewProps {
  date: Date;
  unifiedEvents: UnifiedEvent[];
  onCreateSlot: (slot: {
    date: Date;
    time: string;
  }) => void;
  onEventClick: (event: UnifiedEvent) => void;
  onDayClick?: (date: Date) => void;
}
export default function WeeklyView({
  date,
  unifiedEvents,
  onCreateSlot,
  onEventClick,
  onDayClick
}: WeeklyViewProps) {
  const { availability, deleteAvailabilitySlot } = useAvailability();
  const { isMobile, isTablet, classes } = useResponsiveLayout();
  
  const weekStart = startOfWeek(date);
  const timeSlots = ["08:00", "09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00", "18:00"];
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  // Mapa de dias com isFullDay
  const fullDaySlots = useMemo(() => {
    const map = new Map<string, any>();
    weekDays.forEach(day => {
      const dayKey = format(day, 'yyyy-MM-dd');
      const slot = availability.find(a => a.date === dayKey && a.isFullDay);
      if (slot) map.set(dayKey, slot);
    });
    return map;
  }, [availability, weekDays]);

  // Otimização: Maps indexadas para lookups O(1)
  const { eventMap, availabilityMap, dayCounts } = useMemo(() => {
    // Criar Maps para eventos por slot
    const eventMap = new Map<string, UnifiedEvent>();
    const availabilityMap = new Map<string, any>();
    const dayCountsMap = new Map<string, { sessionsCount: number; availCount: number }>();
    
    // Indexar eventos por dia+hora
    unifiedEvents.forEach(event => {
      if (event.type === 'appointment') {
        weekDays.forEach(day => {
          if (isSameDay(event.date, day)) {
            const key = `${format(day, 'yyyy-MM-dd')}_${event.time}`;
            eventMap.set(key, event);
          }
        });
      }
    });
    
    // Indexar disponibilidades por dia+hora (excluindo isFullDay)
    availability
      .filter(slot => !slot.isFullDay)
      .forEach(slot => {
        const key = `${slot.date}_${slot.time}`;
        if (!eventMap.has(key)) { // Não mostrar se há agendamento
          availabilityMap.set(key, slot);
        }
      });
    
    // Calcular contadores por dia
    weekDays.forEach(day => {
      const dayKey = format(day, 'yyyy-MM-dd');
      const dayAppointments = unifiedEvents.filter(e => 
        isSameDay(e.date, day) && e.type === 'appointment'
      );
      const takenTimes = new Set(dayAppointments.map(e => e.time));
      const availCount = new Set(
        availability
          .filter(a => a.date === dayKey && !a.isFullDay && !takenTimes.has(a.time))
          .map(a => a.time)
      ).size;
      
      dayCountsMap.set(dayKey, {
        sessionsCount: dayAppointments.length,
        availCount
      });
    });
    
    return { eventMap, availabilityMap, dayCounts: dayCountsMap };
  }, [unifiedEvents, availability, weekDays]);
  
  // Funções otimizadas usando Maps
  const getEventForSlot = (day: Date, time: string) => {
    const key = `${format(day, 'yyyy-MM-dd')}_${time}`;
    return eventMap.get(key);
  };
  
  const getAvailabilityForSlot = (day: Date, time: string) => {
    const key = `${format(day, 'yyyy-MM-dd')}_${time}`;
    return availabilityMap.get(key);
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
        const dateStr = format(day, "dd 'de' MMMM", { locale: ptBR });
        const weekdayStr = format(day, 'eeee', { locale: ptBR });
        const times = slots.map(formatTimeBr).join('\n');
        sections.push(`Dia ${dateStr}, ${weekdayStr}:\n${times}`);
      }
    }
    if (sections.length === 0) {
      toast.error('Não há disponibilidades nesta semana.');
      return;
    }
    const text = 'Tenho os seguintes horários:\n\n' + sections.join('\n\n');
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
          {weekDays.map((day, index) => {
            const dayKey = format(day, 'yyyy-MM-dd');
            const fullDaySlot = fullDaySlots.get(dayKey);
            
            return (
              <div 
                key={index} 
                className={cn(
                  "text-center cursor-pointer hover:opacity-80 transition-all",
                  isTablet ? 'p-1' : 'p-1 md:p-2',
                  fullDaySlot ? "border-b-2" : "bg-muted"
                )}
                style={fullDaySlot ? {
                  backgroundColor: `${fullDaySlot.color || 'hsl(var(--lunar-accent))'}15`,
                  borderBottomColor: fullDaySlot.color || 'hsl(var(--lunar-accent))'
                } : undefined}
                onClick={() => onDayClick?.(day)}
                role="button"
                tabIndex={0}
                title={fullDaySlot ? `${fullDaySlot.fullDayDescription || fullDaySlot.label || 'Dia todo'} - Ver agenda` : `Ver agenda do dia ${format(day, 'd')}`}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onDayClick?.(day);
                  }
                }}
              >
                <p className={`text-muted-foreground font-medium ${isTablet ? 'text-[10px]' : 'text-xs'}`}>{formatDayName(day)}</p>
                <p className={`font-semibold ${isTablet ? 'text-xs' : 'text-xs md:text-sm'}`}>{format(day, 'd')}</p>
                {fullDaySlot && (
                  <p className={`truncate ${isTablet ? 'text-[8px]' : 'text-[10px]'}`} style={{ color: fullDaySlot.color }}>
                    {fullDaySlot.label || 'Dia todo'}
                  </p>
                )}
              </div>
            );
          })}
          
          {/* Time slots */}
          {timeSlots.map(time => (
            <React.Fragment key={time}>
              {/* Time label */}
              <div className={classes.timeLabel}>
                {time}
              </div>
              
              {/* Time slots for each day */}
              {weekDays.map((day, dayIndex) => {
                const event = getEventForSlot(day, time);
                return (
                  <div 
                    key={`${dayIndex}-${time}`} 
                    onClick={() => !event && onCreateSlot({ date: day, time })} 
                    className={`relative cursor-pointer bg-card hover:bg-muted ${classes.weeklyTimeSlot}`}
                  >
                    {event ? <div onClick={e => e.stopPropagation()}>
                          <UnifiedEventCard event={event} onClick={onEventClick} variant="weekly" />
                        </div> : (() => {
                          const slot = getAvailabilityForSlot(day, time);
                          
                          // FASE 4: Verificar se há agendamento confirmado no mesmo horário
                          const confirmedAtSlot = unifiedEvents.some(e => 
                            e.type === 'appointment' && 
                            e.originalData?.status === 'confirmado' &&
                            isSameDay(e.date, day) &&
                            e.time === time
                          );
                          
                          if (!slot) return null;
                          
                          if (isMobile) {
                            // Mobile: apenas ponto colorido
                            return <div className="absolute inset-0 flex items-center justify-center">
                              <span 
                                className={`h-3 w-3 rounded-full ${confirmedAtSlot ? 'opacity-30' : ''}`}
                                style={{ 
                                  backgroundColor: slot.color || 'hsl(var(--availability))'
                                }}
                                aria-label={confirmedAtSlot ? 'Horário ocupado' : 'Horário disponível'}
                              />
                            </div>;
                          }
                          
                          // Desktop/Tablet: label com botão remover
                          return (
                            <div className={`absolute inset-0 flex items-center justify-center ${isTablet ? 'gap-1' : 'gap-2'} ${confirmedAtSlot ? 'opacity-40' : ''}`}>
                              <span 
                                className={`rounded text-lunar-text border ${isTablet ? 'text-[8px] px-1 py-0.5' : 'text-[10px] px-1.5 py-0.5'}`}
                                style={{ 
                                  backgroundColor: slot.color ? `${slot.color}20` : 'hsl(var(--availability) / 0.2)',
                                  borderColor: slot.color ? `${slot.color}80` : 'hsl(var(--availability) / 0.5)'
                                }}
                              >
                                {confirmedAtSlot ? '🔒 Ocupado' : (slot.label || 'Disponível')}
                              </span>
                              {!confirmedAtSlot && (
                                <button 
                                  type="button" 
                                  onClick={e => {
                                    e.stopPropagation();
                                    handleRemoveAvailability(day, time);
                                  }} 
                                  className={`text-muted-foreground hover:text-foreground items-center gap-1 ${isTablet ? 'text-[8px] inline-flex' : 'text-[10px] hidden lg:inline-flex'}`} 
                                  aria-label="Remover disponibilidade" 
                                  title="Remover disponibilidade"
                                >
                                  <Trash2 className={isTablet ? 'h-2.5 w-2.5' : 'h-3 w-3'} /> 
                                  {!isTablet && 'Remover'}
                                </button>
                              )}
                            </div>
                          );
                        })()}
                  </div>
                );
              })}
            </React.Fragment>
          ))}
        </div>
      </div>
    </div>;
}