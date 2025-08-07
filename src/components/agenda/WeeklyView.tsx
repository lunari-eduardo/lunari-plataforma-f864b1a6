
import React from 'react';
import { startOfWeek, addDays, format, isSameDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { UnifiedEvent } from '@/hooks/useUnifiedCalendar';
import UnifiedEventCard from './UnifiedEventCard';

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

  return (
    <div className="overflow-x-auto pb-4">
      <div className="min-w-[300px] md:min-w-[700px]">
        <div className="grid grid-cols-8 gap-px bg-border">
          {/* First cell empty - for time labels */}
          <div className="bg-muted"></div>
          
          {/* Day headers */}
          {weekDays.map((day, index) => (
            <div key={index} className="p-1 md:p-2 text-center bg-muted">
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
                    className="border border-border h-8 md:h-10 p-0.5 md:p-1 relative bg-card cursor-pointer hover:bg-muted"
                  >
                    {event ? (
                      <div onClick={(e) => e.stopPropagation()}>
                        <UnifiedEventCard 
                          event={event} 
                          onClick={onEventClick}
                          variant="weekly"
                        />
                      </div>
                    ) : null}
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
