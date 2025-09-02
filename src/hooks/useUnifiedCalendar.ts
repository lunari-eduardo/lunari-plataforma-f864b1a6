
import { useMemo } from 'react';
import { useAppointments } from './useAppointments';
import { useOrcamentos } from './useOrcamentos';
import { Appointment } from './useAgenda';
import { Orcamento } from '@/types/orcamentos';
import { parseDateFromStorage } from '@/utils/dateUtils';

export interface UnifiedEvent {
  id: string;
  type: 'appointment' | 'budget';
  title: string;
  date: Date;
  time: string;
  client: string;
  status: string;
  description?: string;
  originalData: Appointment | Orcamento;
}

export const useUnifiedCalendar = () => {
  const { appointments } = useAppointments();
  const { orcamentos } = useOrcamentos();

  // Create appointment ID Set for O(1) lookups
  const appointmentIdSet = useMemo(() => {
    const set = new Set<string>();
    appointments.forEach(app => {
      set.add(app.id);
      if ((app as any).orcamentoId) {
        set.add(`orcamento-${(app as any).orcamentoId}`);
      }
    });
    return set;
  }, [appointments]);

  // Memoizar eventos de agendamentos com otimização
  const appointmentEvents = useMemo(() => {
    return appointments.map(appointment => ({
      id: `appointment-${appointment.id}`,
      type: 'appointment' as const,
      title: appointment.title,
      date: appointment.date,
      time: appointment.time,
      client: appointment.client,
      status: appointment.status,
      description: appointment.description,
      originalData: appointment
    }));
  }, [appointments]);

  // Memoizar eventos de orçamentos com filtro otimizado
  const budgetEvents = useMemo(() => {
    const validBudgets: UnifiedEvent[] = [];
    
    for (const orcamento of orcamentos) {
      // Filter conditions - fail fast
      if (orcamento.status === 'fechado' || orcamento.status === 'perdido') continue;
      if (!orcamento.hora || orcamento.hora === '') continue;
      
      // Use Set for O(1) lookup instead of some() which is O(n)
      if (appointmentIdSet.has(`orcamento-${orcamento.id}`)) continue;
      
      const eventDate = parseDateFromStorage(orcamento.data);
      if (isNaN(eventDate.getTime())) continue;
      
      validBudgets.push({
        id: `budget-${orcamento.id}`,
        type: 'budget' as const,
        title: orcamento.cliente.nome,
        date: eventDate,
        time: orcamento.hora,
        client: orcamento.cliente.nome,
        status: orcamento.status,
        description: orcamento.descricao || orcamento.categoria,
        originalData: orcamento
      });
    }
    
    return validBudgets;
  }, [orcamentos, appointmentIdSet]);

  // Combinar eventos com memoização
  const unifiedEvents = useMemo(() => {
    return [...appointmentEvents, ...budgetEvents];
  }, [appointmentEvents, budgetEvents]);

  // Create event lookup Maps for O(1) access
  const eventMaps = useMemo(() => {
    const dateMap = new Map<string, UnifiedEvent[]>();
    const slotMap = new Map<string, UnifiedEvent>();
    
    for (const event of unifiedEvents) {
      const dateKey = event.date.toDateString();
      
      // Group by date
      if (!dateMap.has(dateKey)) {
        dateMap.set(dateKey, []);
      }
      dateMap.get(dateKey)!.push(event);
      
      // Index by date+time slot
      const slotKey = `${dateKey}_${event.time}`;
      if (!slotMap.has(slotKey)) {
        slotMap.set(slotKey, event);
      }
    }
    
    // Sort events by time within each date
    for (const events of dateMap.values()) {
      events.sort((a, b) => (a.time || '00:00').localeCompare(b.time || '00:00'));
    }
    
    return { dateMap, slotMap };
  }, [unifiedEvents]);

  // Optimized lookup functions using Maps
  const getEventsForDate = useMemo(() => {
    return (date: Date) => {
      const dateKey = date.toDateString();
      return eventMaps.dateMap.get(dateKey) || [];
    };
  }, [eventMaps.dateMap]);

  const getEventForSlot = useMemo(() => {
    return (date: Date, time: string) => {
      const slotKey = `${date.toDateString()}_${time}`;
      return eventMaps.slotMap.get(slotKey);
    };
  }, [eventMaps.slotMap]);

  return {
    unifiedEvents,
    getEventsForDate,
    getEventForSlot,
    appointments,
    orcamentos
  };
};
