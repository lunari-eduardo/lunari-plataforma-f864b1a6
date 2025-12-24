import { useMemo } from 'react';
import { startOfMonth, endOfMonth, eachDayOfInterval, format, isToday, isSameDay } from 'date-fns';
import { UnifiedEvent } from '@/hooks/useUnifiedCalendar';
import UnifiedEventCard from './UnifiedEventCard';
import { useAvailability } from '@/hooks/useAvailability';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';
interface MonthlyViewProps {
  date: Date;
  unifiedEvents: UnifiedEvent[];
  onCreateSlot: (slot: {
    date: Date;
  }) => void;
  onEventClick: (event: UnifiedEvent) => void;
  onDayClick: (date: Date) => void;
}
// Hook personalizado para contadores de dia
const useDayMetrics = (day: Date, unifiedEvents: UnifiedEvent[], availability: any[]) => {
  return useMemo(() => {
    const dayKey = format(day, 'yyyy-MM-dd');
    
    // Detectar slot de dia todo
    const fullDaySlot = availability.find(
      (a: any) => a.date === dayKey && a.isFullDay
    );
    
    const sessionCount = unifiedEvents.filter(e => 
      isSameDay(e.date, day) && e.type === 'appointment'
    ).length;
    
    const takenTimes = new Set(
      unifiedEvents
        .filter(e => isSameDay(e.date, day) && e.type === 'appointment')
        .map(e => e.time || '')
    );
    
    // Não contar disponibilidade se for dia todo
    const availCount = fullDaySlot ? 0 : new Set(
      availability
        .filter((a: any) => a.date === dayKey && !takenTimes.has(a.time) && !a.isFullDay)
        .map((a: any) => a.time)
    ).size;
    
    return { sessionCount, availCount, dayKey, fullDaySlot };
  }, [day, unifiedEvents, availability]);
};

export default function MonthlyView({
  date,
  unifiedEvents,
  onCreateSlot,
  onEventClick,
  onDayClick
}: MonthlyViewProps) {
  const { availability } = useAvailability();
  const { isMobile, classes } = useResponsiveLayout();
  
  const monthStart = startOfMonth(date);
  const monthEnd = endOfMonth(date);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const weekDays = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];
  const startWeekday = monthStart.getDay();
  const emptyDaysBefore = Array(startWeekday).fill(null);
  const getEventsForDay = (day: Date) => {
    const dayEvents = unifiedEvents.filter(event => isSameDay(event.date, day));
    const uniqueEvents = new Map();
    dayEvents.forEach(event => {
      uniqueEvents.set(event.id, event);
    });
    const eventsArray = Array.from(uniqueEvents.values());
    // Sort events by time in ascending order
    return eventsArray.sort((a, b) => {
      const timeA = a.time || '00:00';
      const timeB = b.time || '00:00';
      return timeA.localeCompare(timeB);
    });
  };
  return (
    <div className="w-full h-full overflow-auto">
      <div className="grid grid-cols-7 gap-px rounded-lg p-1 bg-lunar-border/30">
        {/* Weekday headers */}
        {weekDays.map((day) => (
          <div 
            key={day} 
            className="h-8 md:h-10 p-1 md:p-2 text-center text-xs font-medium text-muted-foreground bg-lunar-surface border border-lunar-border/20"
          >
            {day}
          </div>
        ))}
        
        {/* Empty cells before first day */}
        {emptyDaysBefore.map((_, index) => (
          <div 
            key={`empty-${index}`} 
            className={classes.calendarCell + " bg-lunar-bg border border-lunar-border/20"}
          />
        ))}
        
        {/* Days of the month */}
        {daysInMonth.map(day => {
          const dayEvents = getEventsForDay(day);
          const maxDisplayEvents = 1;
          const hasMoreEvents = dayEvents.length > maxDisplayEvents;
          const displayEvents = dayEvents.slice(0, maxDisplayEvents);
          
          return (
            <DayCell
              key={day.toString()}
              day={day}
              dayEvents={dayEvents}
              displayEvents={displayEvents}
              hasMoreEvents={hasMoreEvents}
              maxDisplayEvents={maxDisplayEvents}
              availability={availability}
              unifiedEvents={unifiedEvents}
              isMobile={isMobile}
              onDayClick={onDayClick}
              onEventClick={onEventClick}
              classes={classes}
            />
          );
        })}
      </div>
    </div>
  );
}

// Componente extraído para célula do dia
const DayCell = ({
  day,
  dayEvents,
  displayEvents,
  hasMoreEvents,
  maxDisplayEvents,
  availability,
  unifiedEvents,
  isMobile,
  onDayClick,
  onEventClick,
  classes
}: {
  day: Date;
  dayEvents: UnifiedEvent[];
  displayEvents: UnifiedEvent[];
  hasMoreEvents: boolean;
  maxDisplayEvents: number;
  availability: any[];
  unifiedEvents: UnifiedEvent[];
  isMobile: boolean;
  onDayClick: (date: Date) => void;
  onEventClick: (event: UnifiedEvent) => void;
  classes: any;
}) => {
  const { sessionCount, availCount, dayKey, fullDaySlot } = useDayMetrics(day, unifiedEvents, availability);

  // Estilos dinâmicos para dia todo
  const cellStyle = fullDaySlot ? {
    backgroundColor: fullDaySlot.color 
      ? `${fullDaySlot.color}15`  // Cor esmaecida (15% opacidade)
      : 'hsl(var(--muted))',
    borderColor: fullDaySlot.color || 'hsl(var(--border))'
  } : {};

  const cellClassName = `${classes.calendarCell} cursor-pointer transition-colors ${
    fullDaySlot 
      ? 'border-2' 
      : 'bg-lunar-surface hover:bg-lunar-surface/80 border border-lunar-border/20 hover:border-lunar-border/40'
  }`;

  return (
    <div 
      onClick={() => onDayClick(day)} 
      className={cellClassName}
      style={cellStyle}
    >
      <div className="flex justify-between items-center mb-1 md:mb-2">
        <span className={`
          text-xs md:text-sm font-medium h-5 w-5 md:h-6 md:w-6 flex items-center justify-center rounded-full
          ${isToday(day) ? 'bg-primary text-primary-foreground' : 'text-foreground'}
        `}>
          {format(day, 'd')}
        </span>
        {/* Availability count badge (desktop only) - não mostrar se for dia todo */}
        {!isMobile && !fullDaySlot && availCount > 0 && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-availability/20 border border-availability/50 text-lunar-text">
            {availCount}
          </span>
        )}
      </div>

      <div className="space-y-px md:space-y-1">
        {/* Label do dia todo */}
        {fullDaySlot && (
          <div className="flex items-center gap-1">
            <div 
              className="w-2 h-2 rounded-full flex-shrink-0" 
              style={{ backgroundColor: fullDaySlot.color || 'hsl(var(--muted-foreground))' }}
            />
            <span className="text-[10px] md:text-xs font-medium truncate">
              {fullDaySlot.label || 'Dia todo'}
            </span>
          </div>
        )}
        
        {isMobile ? (
          !fullDaySlot && (
            <div className="flex items-center gap-2">
              {sessionCount > 0 && (
                <span className="inline-flex items-center gap-1 text-[10px]">
                  <span className="h-2.5 w-2.5 rounded-full bg-primary" aria-hidden />
                  {sessionCount}
                </span>
              )}
              {availCount > 0 && (
                <span className="inline-flex items-center gap-1 text-[10px]">
                  <span className="h-2.5 w-2.5 rounded-full bg-availability" aria-hidden />
                  {availCount}
                </span>
              )}
            </div>
          )
        ) : (
          !fullDaySlot && (
            <>
              {displayEvents.map(event => (
                <div key={event.id} onClick={e => e.stopPropagation()}>
                  <UnifiedEventCard event={event} onClick={onEventClick} variant="monthly" />
                </div>
              ))}
              {hasMoreEvents && (
                <div className="text-xs p-0.5 md:p-1 text-muted-foreground font-medium">
                  +{dayEvents.length - maxDisplayEvents} mais
                </div>
              )}
            </>
          )
        )}
      </div>
    </div>
  );
};