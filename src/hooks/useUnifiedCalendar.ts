
import { useMemo } from 'react';
import { useAgenda, Appointment } from './useAgenda';
import { useOrcamentos } from './useOrcamentos';
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
  const { appointments } = useAgenda();
  const { orcamentos } = useOrcamentos();

  // Memoizar eventos de agendamentos separadamente
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

  // Memoizar eventos de orçamentos separadamente
  const budgetEvents = useMemo(() => {
    return orcamentos
      .filter(orc => orc.status !== 'fechado' && orc.status !== 'cancelado')
      .map(orcamento => {
        const eventDate = parseDateFromStorage(orcamento.data);
        if (isNaN(eventDate.getTime())) {
          return null;
        }
        
        return {
          id: `budget-${orcamento.id}`,
          type: 'budget' as const,
          title: orcamento.cliente.nome,
          date: eventDate,
          time: orcamento.hora,
          client: orcamento.cliente.nome,
          status: orcamento.status,
          description: orcamento.descricao || orcamento.categoria,
          originalData: orcamento
        };
      })
      .filter((event): event is NonNullable<typeof event> => event !== null);
  }, [orcamentos]);

  // Combinar eventos com memoização otimizada
  const unifiedEvents = useMemo(() => {
    return [...appointmentEvents, ...budgetEvents];
  }, [appointmentEvents, budgetEvents]);

  const getEventsForDate = useMemo(() => {
    return (date: Date) => {
      const targetDateString = date.toDateString();
      return unifiedEvents.filter(event => 
        event.date.toDateString() === targetDateString
      );
    };
  }, [unifiedEvents]);

  const getEventForSlot = useMemo(() => {
    return (date: Date, time: string) => {
      const targetDateString = date.toDateString();
      return unifiedEvents.find(event => 
        event.date.toDateString() === targetDateString && 
        event.time === time
      );
    };
  }, [unifiedEvents]);

  return {
    unifiedEvents,
    getEventsForDate,
    getEventForSlot,
    appointments,
    orcamentos
  };
};
