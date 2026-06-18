import { useMemo, useState } from 'react';
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  isToday,
  addMonths,
  subMonths,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { UnifiedEvent } from '@/hooks/useUnifiedCalendar';
import type { Appointment } from '@/hooks/useAgenda';

interface MiniMonthCalendarProps {
  selectedDate: Date;
  unifiedEvents: UnifiedEvent[];
  availability?: Array<{ date: string; isFullDay?: boolean; label?: string }>;
  onDateSelect: (date: Date) => void;
  onToday?: () => void;
}

const WEEK_LABELS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

export default function MiniMonthCalendar({
  selectedDate,
  unifiedEvents,
  availability = [],
  onDateSelect,
  onToday,
}: MiniMonthCalendarProps) {
  const [viewMonth, setViewMonth] = useState<Date>(selectedDate);

  const dotsByDay = useMemo(() => {
    // Returns map of yyyy-MM-dd -> priority dot color
    const map = new Map<string, string>();
    const setIfHigher = (key: string, color: string, weight: number) => {
      const current = (map.get(key + '__w') as any) ?? 0;
      if (weight > current) {
        map.set(key, color);
        map.set(key + '__w', weight as any);
      }
    };

    for (const a of availability) {
      if (a.isFullDay && a.label === 'Bloqueado') {
        setIfHigher(a.date, 'hsl(var(--event-blocked))', 5);
      } else {
        setIfHigher(a.date, 'hsl(var(--event-available))', 1);
      }
    }

    for (const ev of unifiedEvents) {
      if (ev.type !== 'appointment') continue;
      const key = format(ev.date, 'yyyy-MM-dd');
      const apt = ev.originalData as Appointment;
      if ((apt as any).origem === 'orcamento') {
        setIfHigher(key, 'hsl(var(--event-budget))', 4);
      } else if (apt.status === 'confirmado') {
        setIfHigher(key, 'hsl(var(--event-confirmed))', 3);
      } else {
        setIfHigher(key, 'hsl(var(--event-pending))', 2);
      }
    }

    return map;
  }, [unifiedEvents, availability]);

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(viewMonth));
    const end = endOfWeek(endOfMonth(viewMonth));
    return eachDayOfInterval({ start, end });
  }, [viewMonth]);

  const handleToday = () => {
    const now = new Date();
    setViewMonth(now);
    onDateSelect(now);
    onToday?.();
  };

  return (
    <div className="select-none">
      <div className="flex items-center justify-between mb-2">
        <button
          type="button"
          onClick={handleToday}
          className="text-xs font-semibold capitalize hover:text-primary transition-colors"
          title="Ir para hoje"
        >
          {format(viewMonth, "MMMM 'de' yyyy", { locale: ptBR })}
        </button>
        <div className="flex items-center gap-0.5">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => setViewMonth((d) => subMonths(d, 1))}
            aria-label="Mês anterior"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => setViewMonth((d) => addMonths(d, 1))}
            aria-label="Próximo mês"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-0.5 mb-1">
        {WEEK_LABELS.map((label, i) => (
          <div
            key={`${label}-${i}`}
            className="text-[10px] font-medium text-muted-foreground text-center"
          >
            {label}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-0.5">
        {days.map((day) => {
          const key = format(day, 'yyyy-MM-dd');
          const dotColor = dotsByDay.get(key);
          const inMonth = isSameMonth(day, viewMonth);
          const selected = isSameDay(day, selectedDate);
          const today = isToday(day);

          return (
            <button
              key={day.toISOString()}
              type="button"
              onClick={() => {
                setViewMonth(day);
                onDateSelect(day);
              }}
              className={cn(
                'relative aspect-square flex items-center justify-center rounded-md text-[11px] transition-all',
                'hover:bg-accent/50',
                !inMonth && 'opacity-30',
                today && !selected && 'ring-1 ring-primary/60 font-semibold',
                selected && 'bg-primary text-primary-foreground font-semibold hover:bg-primary'
              )}
              aria-selected={selected}
              aria-label={format(day, "d 'de' MMMM", { locale: ptBR })}
            >
              {format(day, 'd')}
              {dotColor && !selected && (
                <span
                  className="absolute bottom-0.5 left-1/2 -translate-x-1/2 h-1 w-1 rounded-full"
                  style={{ backgroundColor: dotColor }}
                  aria-hidden
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
