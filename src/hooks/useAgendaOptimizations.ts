import { useMemo } from 'react';
import { format, isSameDay } from 'date-fns';
import { UnifiedEvent } from '@/hooks/useUnifiedCalendar';

/**
 * Hook otimizado para cálculos de agenda
 * Centraliza lógica de Maps e contadores para melhor performance
 */
export const useAgendaOptimizations = (
  unifiedEvents: UnifiedEvent[], 
  availability: any[], 
  dates: Date[]
) => {
  return useMemo(() => {
    // Criar Maps para lookups O(1)
    const eventMap = new Map<string, UnifiedEvent>();
    const availabilityMap = new Map<string, any>();
    const dayCountsMap = new Map<string, { sessionsCount: number; availCount: number }>();
    
    // Indexar eventos por dia+hora
    unifiedEvents.forEach(event => {
      if (event.type === 'appointment') {
        dates.forEach(day => {
          if (isSameDay(event.date, day)) {
            const key = `${format(day, 'yyyy-MM-dd')}_${event.time}`;
            eventMap.set(key, event);
          }
        });
      }
    });
    
    // Indexar disponibilidades por dia+hora
    availability.forEach(slot => {
      const key = `${slot.date}_${slot.time}`;
      if (!eventMap.has(key)) { // Não mostrar se há agendamento
        availabilityMap.set(key, slot);
      }
    });
    
    // Calcular contadores por dia
    dates.forEach(day => {
      const dayKey = format(day, 'yyyy-MM-dd');
      const dayAppointments = unifiedEvents.filter(e => 
        isSameDay(e.date, day) && e.type === 'appointment'
      );
      const takenTimes = new Set(dayAppointments.map(e => e.time));
      const availCount = new Set(
        availability
          .filter(a => a.date === dayKey && !takenTimes.has(a.time))
          .map(a => a.time)
      ).size;
      
      dayCountsMap.set(dayKey, {
        sessionsCount: dayAppointments.length,
        availCount
      });
    });
    
    return { 
      eventMap, 
      availabilityMap, 
      dayCounts: dayCountsMap,
      // Funções auxiliares otimizadas
      getEventForSlot: (day: Date, time: string) => {
        const key = `${format(day, 'yyyy-MM-dd')}_${time}`;
        return eventMap.get(key);
      },
      getAvailabilityForSlot: (day: Date, time: string) => {
        const key = `${format(day, 'yyyy-MM-dd')}_${time}`;
        return availabilityMap.get(key);
      },
      getDayCounts: (day: Date) => {
        const key = format(day, 'yyyy-MM-dd');
        return dayCountsMap.get(key) || { sessionsCount: 0, availCount: 0 };
      }
    };
  }, [unifiedEvents, availability, dates]);
};