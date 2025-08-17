import { useMemo } from 'react';
import { isSameDay } from 'date-fns';
import { useAppContext } from '@/contexts/AppContext';
import { useAvailability } from './useAvailability';
import type { Appointment, AppointmentStatus } from './useAgenda';

export interface ConflictValidationResult {
  valid: boolean;
  reason?: string;
  needsResolution?: boolean;
  conflictingAppointments?: Appointment[];
}

export interface NextAvailableSlot {
  date: Date;
  time: string;
}

export const useConflictResolution = () => {
  const { appointments, updateAppointment } = useAppContext();
  const { availability } = useAvailability();

  // Validar conflitos de horário baseado no status
  const validateTimeConflict = (date: Date, time: string, status: AppointmentStatus): ConflictValidationResult => {
    const existingApps = appointments.filter(app => 
      isSameDay(app.date, date) && app.time === time
    );
    
    const confirmedExists = existingApps.some(app => app.status === 'confirmado');
    
    // Se tentando confirmar e já existe confirmado
    if (status === 'confirmado' && confirmedExists) {
      return { 
        valid: false, 
        reason: 'Já existe agendamento confirmado neste horário' 
      };
    }
    
    // Se tentando confirmar e existem pendentes
    if (status === 'confirmado' && existingApps.length > 0) {
      return { 
        valid: true, 
        needsResolution: true, 
        conflictingAppointments: existingApps.filter(app => app.status === 'a confirmar')
      };
    }
    
    return { valid: true };
  };

  // Encontrar próximo horário disponível
  const findNextAvailableSlot = (fromDate: Date, fromTime: string): NextAvailableSlot | null => {
    const [hours, minutes] = fromTime.split(':').map(Number);
    const startDateTime = new Date(fromDate);
    startDateTime.setHours(hours, minutes, 0, 0);
    
    // Buscar nos próximos 30 dias
    for (let dayOffset = 0; dayOffset < 30; dayOffset++) {
      const targetDate = new Date(startDateTime);
      targetDate.setDate(targetDate.getDate() + dayOffset);
      
      const targetDateStr = targetDate.toISOString().split('T')[0];
      
      // Buscar disponibilidades para este dia
      const dayAvailability = availability.filter(slot => slot.date === targetDateStr);
      
      for (const slot of dayAvailability) {
        // Verificar se já tem agendamento confirmado neste horário
        const hasConflict = appointments.some(app => 
          isSameDay(app.date, targetDate) && 
          app.time === slot.time && 
          app.status === 'confirmado'
        );
        
        if (!hasConflict) {
          return {
            date: targetDate,
            time: slot.time
          };
        }
      }
    }
    
    return null;
  };

  // Resolver conflitos automaticamente
  const resolveTimeConflicts = (confirmedAppointment: Appointment) => {
    const conflicting = appointments.filter(app => 
      isSameDay(app.date, confirmedAppointment.date) && 
      app.time === confirmedAppointment.time &&
      app.status === 'a confirmar' &&
      app.id !== confirmedAppointment.id
    );
    
    const resolutions: Array<{
      appointment: Appointment;
      newSlot: NextAvailableSlot | null;
    }> = [];
    
    conflicting.forEach(app => {
      const nextSlot = findNextAvailableSlot(app.date, app.time);
      resolutions.push({
        appointment: app,
        newSlot: nextSlot
      });
      
      if (nextSlot) {
        updateAppointment(app.id, {
          date: nextSlot.date,
          time: nextSlot.time
        });
      }
    });
    
    return resolutions;
  };

  // Obter agendamentos pendentes no mesmo horário
  const getPendingConflicts = (date: Date, time: string) => {
    return appointments.filter(app => 
      isSameDay(app.date, date) && 
      app.time === time && 
      app.status === 'a confirmar'
    );
  };

  // Contar conflitos por horário
  const getConflictCounts = useMemo(() => {
    const conflicts = new Map<string, number>();
    
    appointments.forEach(app => {
      if (app.status === 'a confirmar') {
        const key = `${app.date.toDateString()}-${app.time}`;
        conflicts.set(key, (conflicts.get(key) || 0) + 1);
      }
    });
    
    return conflicts;
  }, [appointments]);

  return {
    validateTimeConflict,
    findNextAvailableSlot,
    resolveTimeConflicts,
    getPendingConflicts,
    getConflictCounts
  };
};