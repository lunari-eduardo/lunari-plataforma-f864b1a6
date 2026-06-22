import { useAgendaContext } from '@/contexts/AgendaContext';
import { Appointment } from '@/modules/agenda/presentation';

/**
 * @deprecated Use `useAppointmentsRangeQuery` and the appointment mutation hooks
 * from `@/modules/agenda`. This shim will be removed once all consumers migrate.
 */
export const useAppointments = () => {
  const context = useAgendaContext();

  return {
    // Data
    appointments: context.appointments,
    
    // Operations
    addAppointment: context.addAppointment,
    updateAppointment: context.updateAppointment,
    deleteAppointment: context.deleteAppointment,
    
    // Integration function (preserves workflow integration)
    getConfirmedSessionsForWorkflow: context.getConfirmedSessionsForWorkflow,
    
    // On-demand month loading
    loadMonthData: context.loadMonthData,
    
    // Utility functions
    getAppointmentsForDate: (date: Date) => {
      const targetDate = date.toDateString();
      return context.appointments.filter(appointment => 
        appointment.date.toDateString() === targetDate
      );
    },
    
    getAppointmentsForDateRange: (startDate: Date, endDate: Date) => {
      return context.appointments.filter(appointment => 
        appointment.date >= startDate && appointment.date <= endDate
      );
    },
    
    getConfirmedAppointments: () => {
      return context.appointments.filter(appointment => appointment.status === 'confirmado');
    },
    
    hasConflictingAppointment: (date: Date, time: string, excludeId?: string) => {
      const appointments = context.appointments.filter(appointment => 
        appointment.date.toDateString() === date.toDateString()
      );
      
      return appointments.some(appointment => 
        appointment.time === time && 
        appointment.id !== excludeId
      );
    }
  };
};