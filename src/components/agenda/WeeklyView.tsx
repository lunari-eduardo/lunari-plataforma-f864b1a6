import React, { useMemo } from 'react';
import { format, isSameDay, isToday, startOfWeek, addDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { UnifiedEvent } from '@/modules/agenda/presentation';
import UnifiedEventCard from './UnifiedEventCard';
import { useAvailability } from '@/hooks/useAvailability';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';
import { Trash2 } from 'lucide-react';
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
  const { eventMap, availabilityMap } = useMemo(() => {
    const eventMap = new Map<string, UnifiedEvent>();
    const availabilityMap = new Map<string, any>();

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

    availability
      .filter(slot => !slot.isFullDay)
      .forEach(slot => {
        const key = `${slot.date}_${slot.time}`;
        if (!eventMap.has(key)) {
          availabilityMap.set(key, slot);
        }
      });

    return { eventMap, availabilityMap };
  }, [unifiedEvents, availability, weekDays]);

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

  const cellBorder = "border-r border-b border-border/40 dark:border-white/[0.08]";

  return (
    <div className={`pb-4 scrollbar-elegant ${isMobile ? 'overflow-x-auto' : ''}`}>
      <div className={`${isMobile ? 'min-w-[960px]' : 'w-full'}`}>
        <div className="grid grid-cols-8 rounded-md border border-border/40 dark:border-white/[0.08] overflow-hidden">
          {/* First cell empty - for time labels column header */}
          <div className={cn("bg-muted/30 dark:bg-white/[0.03]", cellBorder)}></div>

          {/* Day headers */}
          {weekDays.map((day, index) => {
            const dayKey = format(day, 'yyyy-MM-dd');
            const fullDaySlot = fullDaySlots.get(dayKey);
            const todayCol = isToday(day);
            const isLast = index === weekDays.length - 1;

            return (
              <div
                key={index}
                className={cn(
                  "text-center cursor-pointer hover:opacity-80 transition-all relative",
                  "bg-muted/30 dark:bg-white/[0.03]",
                  "border-b border-border/40 dark:border-white/[0.08]",
                  !isLast && "border-r border-border/40 dark:border-white/[0.08]",
                  isTablet ? 'p-1' : 'p-1 md:p-2',
                  fullDaySlot && "border-b-2",
                  todayCol && !fullDaySlot && "bg-primary/5 dark:bg-primary/10"
                )}
                style={{
                  ...(fullDaySlot ? {
                    backgroundColor: `${fullDaySlot.color || 'hsl(var(--lunar-accent))'}15`,
                    borderBottomColor: fullDaySlot.color || 'hsl(var(--lunar-accent))'
                  } : {})
                }}
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
                <p
                  className={cn(
                    `font-semibold ${isTablet ? 'text-xs' : 'text-xs md:text-sm'}`,
                    todayCol && "inline-flex items-center justify-center h-5 w-5 md:h-6 md:w-6 rounded-full bg-primary text-primary-foreground"
                  )}
                >
                  {format(day, 'd')}
                </p>
                {fullDaySlot && (
                  <p className={`truncate ${isTablet ? 'text-[8px]' : 'text-[10px]'}`} style={{ color: fullDaySlot.color }}>
                    {fullDaySlot.label || 'Dia todo'}
                  </p>
                )}
              </div>
            );
          })}

          {/* Time slots */}
          {timeSlots.map((time, rowIndex) => {
            const isLastRow = rowIndex === timeSlots.length - 1;
            return (
              <React.Fragment key={time}>
                {/* Time label */}
                <div
                  className={cn(
                    classes.timeLabel,
                    "flex items-center justify-end font-medium text-muted-foreground bg-muted/20 dark:bg-white/[0.02] border-r border-border/40 dark:border-white/[0.08]",
                    !isLastRow && "border-b border-border/40 dark:border-white/[0.08]"
                  )}
                >
                  {time}
                </div>

                {/* Time slots for each day */}
                {weekDays.map((day, dayIndex) => {
                  const event = getEventForSlot(day, time);
                  const isLastCol = dayIndex === weekDays.length - 1;
                  return (
                    <div
                      key={`${dayIndex}-${time}`}
                      onClick={() => !event && onCreateSlot({ date: day, time })}
                      className={cn(
                        "relative cursor-pointer transition-colors hover:bg-muted/40 dark:hover:bg-white/[0.04]",
                        classes.weeklyTimeSlot,
                        !isLastCol && "border-r border-border/40 dark:border-white/[0.08]",
                        !isLastRow && "border-b border-border/40 dark:border-white/[0.08]"
                      )}
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
            );
          })}
        </div>
      </div>
    </div>
  );
}
