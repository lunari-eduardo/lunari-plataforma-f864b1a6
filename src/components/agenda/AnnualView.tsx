import React from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card } from "@/components/ui/card";
import { UnifiedEvent } from "@/hooks/useUnifiedCalendar";
import { cn } from "@/lib/utils";

interface AnnualViewProps {
  date: Date;
  unifiedEvents: UnifiedEvent[];
  onDayClick: (date: Date) => void;
  onEventClick?: (event: UnifiedEvent) => void;
}

// Helper: key for a date (yyyy-MM-dd)
const dateKey = (d: Date) => format(d, "yyyy-MM-dd");

const monthNames = Array.from({ length: 12 }, (_, i) =>
  format(new Date(2020, i, 1), "MMMM", { locale: ptBR })
);

export default function AnnualView({ date, unifiedEvents, onDayClick }: AnnualViewProps) {
  const year = date.getFullYear();

  // Build event counts per date and per month
  const eventsByDate = new Map<string, number>();
  const eventsPerMonth = Array.from({ length: 12 }, () => 0);

  unifiedEvents.forEach((ev) => {
    const d = ev.date instanceof Date ? ev.date : new Date(ev.date);
    if (d.getFullYear() !== year) return;
    const key = dateKey(d);
    eventsByDate.set(key, (eventsByDate.get(key) || 0) + 1);
    eventsPerMonth[d.getMonth()] += 1;
  });

  return (
    <section aria-label={`Calendário anual de ${year}`} className="space-y-3">
      <header className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-lunar-text">{year}</h2>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
        {Array.from({ length: 12 }, (_, monthIndex) => {
          const firstDay = new Date(year, monthIndex, 1);
          const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
          const startWeekday = firstDay.getDay(); // 0-6 (Sun-Sat)

          const blanks = Array.from({ length: startWeekday }, () => null);
          const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

          const totalMonthEvents = eventsPerMonth[monthIndex] || 0;

          return (
            <Card key={monthIndex} className="p-2 bg-lunar-surface border-lunar-border">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium capitalize text-lunar-text">
                  {monthNames[monthIndex]}
                </h3>
                <span className="text-[11px] text-lunar-textSecondary">
                  {totalMonthEvents} eventos
                </span>
              </div>

              {/* Weekday labels */}
              <div className="grid grid-cols-7 gap-1 mb-1 text-[10px] text-lunar-textSecondary">
                {['D','S','T','Q','Q','S','S'].map((d) => (
                  <div key={d} className="text-center">{d}</div>
                ))}
              </div>

              {/* Days grid */}
              <div className="grid grid-cols-7 gap-1">
                {blanks.map((_, i) => (
                  <div key={`b-${i}`} className="h-7" />
                ))}
                {days.map((day) => {
                  const current = new Date(year, monthIndex, day);
                  const key = dateKey(current);
                  const count = eventsByDate.get(key) || 0;

                  return (
                    <button
                      key={day}
                      type="button"
                      aria-label={`Dia ${day} de ${monthNames[monthIndex]} de ${year}${count ? `, ${count} eventos` : ''}`}
                      onClick={() => onDayClick(current)}
                      className={cn(
                        "h-7 w-7 rounded-md flex flex-col items-center justify-center text-[11px] leading-none",
                        "bg-lunar-bg text-lunar-text border border-lunar-border"
                      )}
                    >
                      <span>{day}</span>
                      <span
                        aria-hidden
                        className={cn(
                          "mt-0.5 h-1.5 w-1.5 rounded-full",
                          count > 0 ? "bg-lunar-accent" : "bg-transparent border border-transparent"
                        )}
                      />
                    </button>
                  );
                })}
              </div>
            </Card>
          );
        })}
      </div>
    </section>
  );
}
