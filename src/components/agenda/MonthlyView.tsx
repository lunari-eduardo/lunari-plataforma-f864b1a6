import { useState } from 'react';
import { startOfMonth, endOfMonth, eachDayOfInterval, format, isSameMonth, isToday, isSameDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { UnifiedEvent } from '@/hooks/useUnifiedCalendar';
import UnifiedEventCard from './UnifiedEventCard';
interface MonthlyViewProps {
  date: Date;
  unifiedEvents: UnifiedEvent[];
  onCreateSlot: (slot: {
    date: Date;
  }) => void;
  onEventClick: (event: UnifiedEvent) => void;
  onDayClick: (date: Date) => void;
}
export default function MonthlyView({
  date,
  unifiedEvents,
  onCreateSlot,
  onEventClick,
  onDayClick
}: MonthlyViewProps) {
  const monthStart = startOfMonth(date);
  const monthEnd = endOfMonth(date);
  const daysInMonth = eachDayOfInterval({
    start: monthStart,
    end: monthEnd
  });
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
  return <div className="w-full overflow-auto">
      <div className="grid grid-cols-7 gap-1 rounded-lg p-1 bg-neutral-50">
        {/* Weekday headers */}
        {weekDays.map((day, index) => <div key={day} className="h-10 p-2 text-center text-xs font-medium text-gray-600 rounded bg-lunar-border">
            {day}
          </div>)}
        
        {/* Empty cells before first day */}
        {emptyDaysBefore.map((_, index) => <div key={`empty-${index}`} className="min-h-[120px] rounded bg-lunar-bg"></div>)}
        
        {/* Days of the month */}
        {daysInMonth.map(day => {
        const dayEvents = getEventsForDay(day);
        const maxDisplayEvents = 2;
        const hasMoreEvents = dayEvents.length > maxDisplayEvents;
        const displayEvents = dayEvents.slice(0, maxDisplayEvents);
        return <div key={day.toString()} onClick={() => onDayClick(day)} className="min-h-[120px] rounded p-2 cursor-pointer transition-colors bg-lunar-surface hover:bg-lunar-bg">
              <div className="flex justify-between items-center mb-2">
                <span className={`
                  text-sm font-medium h-6 w-6 flex items-center justify-center rounded-full
                  ${isToday(day) ? 'bg-blue-500 text-white' : 'text-gray-700'}
                `}>
                  {format(day, 'd')}
                </span>
              </div>
              
              <div className="space-y-1">
                {displayEvents.map(event => <div key={event.id} onClick={e => e.stopPropagation()}>
                    <UnifiedEventCard event={event} onClick={onEventClick} compact={true} />
                  </div>)}
                
                {hasMoreEvents && <div className="text-xs p-1 text-gray-500 font-medium">
                    +{dayEvents.length - maxDisplayEvents} mais
                  </div>}
                
                {dayEvents.length === 0}
              </div>
            </div>;
      })}
      </div>
    </div>;
}