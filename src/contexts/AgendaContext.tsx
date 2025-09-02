import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { AgendaService } from '@/services/AgendaService';
import { Appointment } from '@/hooks/useAgenda';
import { AvailabilitySlot, AvailabilityType } from '@/types/availability';
import { AgendaSettings } from '@/types/agenda-supabase';

interface AgendaContextType {
  // Estado
  appointments: Appointment[];
  availability: AvailabilitySlot[];
  availabilityTypes: AvailabilityType[];
  agendaSettings: AgendaSettings;
  loading: boolean;
  error: string | null;

  // Appointments CRUD
  addAppointment: (appointment: Omit<Appointment, 'id'>) => Promise<Appointment>;
  updateAppointment: (id: string, updates: Partial<Appointment>) => Promise<Appointment>;
  deleteAppointment: (id: string, preservePayments?: boolean) => Promise<void>;

  // Availability CRUD
  addAvailabilitySlots: (slots: Omit<AvailabilitySlot, 'id'>[]) => Promise<AvailabilitySlot[]>;
  clearAvailabilityForDate: (date: string) => Promise<void>;
  deleteAvailabilitySlot: (id: string) => Promise<void>;

  // Availability Types CRUD
  addAvailabilityType: (type: Omit<AvailabilityType, 'id'>) => Promise<AvailabilityType>;
  updateAvailabilityType: (id: string, updates: Partial<AvailabilityType>) => Promise<AvailabilityType>;
  deleteAvailabilityType: (id: string) => Promise<void>;

  // Settings
  updateAgendaSettings: (settings: Partial<AgendaSettings>) => Promise<void>;

  // Utility methods
  getAppointmentsForDate: (date: Date) => Appointment[];
  getAvailabilityForDate: (date: Date) => AvailabilitySlot[];

  // Refresh data
  refreshAppointments: () => Promise<void>;
  refreshAvailability: () => Promise<void>;
}

const AgendaContext = createContext<AgendaContextType | undefined>(undefined);

interface AgendaProviderProps {
  children: React.ReactNode;
  agendaService?: AgendaService;
}

export const AgendaProvider: React.FC<AgendaProviderProps> = ({ 
  children, 
  agendaService = new AgendaService() 
}) => {
  // Estado local
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [availability, setAvailability] = useState<AvailabilitySlot[]>([]);
  const [availabilityTypes, setAvailabilityTypes] = useState<AvailabilityType[]>([]);
  const [agendaSettings, setAgendaSettings] = useState<AgendaSettings>({
    preferredView: 'month',
    timeSlots: ['09:00', '10:00', '11:00', '14:00', '15:00', '16:00', '17:00'],
    workingDays: [1, 2, 3, 4, 5],
    workingHours: { start: '09:00', end: '18:00' },
    conflictResolution: 'warn'
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Carregar dados inicial
  const loadInitialData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [appointmentsData, availabilityData, typesData, settingsData] = await Promise.all([
        agendaService.getAppointments(),
        agendaService.getAvailabilitySlots(),
        agendaService.getAvailabilityTypes(),
        agendaService.getAgendaSettings()
      ]);

      setAppointments(appointmentsData);
      setAvailability(availabilityData);
      setAvailabilityTypes(typesData);
      setAgendaSettings(settingsData);
    } catch (err) {
      console.error('Erro ao carregar dados da agenda:', err);
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  }, [agendaService]);

  // Effect para carregar dados e configurar listeners
  useEffect(() => {
    loadInitialData();

    // Configurar listeners para mudanças em tempo real
    const unsubscribeAppointments = agendaService.onAppointmentsChange(setAppointments);
    const unsubscribeAvailability = agendaService.onAvailabilityChange(setAvailability);

    return () => {
      unsubscribeAppointments();
      unsubscribeAvailability();
    };
  }, [loadInitialData, agendaService]);

  // Appointments CRUD
  const addAppointment = useCallback(async (appointmentData: Omit<Appointment, 'id'>) => {
    try {
      const newAppointment = await agendaService.createAppointment(appointmentData);
      // O estado será atualizado via listener
      return newAppointment;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao criar agendamento';
      setError(errorMessage);
      throw err;
    }
  }, [agendaService]);

  const updateAppointment = useCallback(async (id: string, updates: Partial<Appointment>) => {
    try {
      const updatedAppointment = await agendaService.updateAppointment(id, updates);
      // O estado será atualizado via listener
      return updatedAppointment;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao atualizar agendamento';
      setError(errorMessage);
      throw err;
    }
  }, [agendaService]);

  const deleteAppointment = useCallback(async (id: string, preservePayments?: boolean) => {
    try {
      await agendaService.deleteAppointment(id);
      // O estado será atualizado via listener
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao remover agendamento';
      setError(errorMessage);
      throw err;
    }
  }, [agendaService]);

  // Availability CRUD
  const addAvailabilitySlots = useCallback(async (slots: Omit<AvailabilitySlot, 'id'>[]) => {
    try {
      const newSlots = await agendaService.createAvailabilitySlots(slots);
      // O estado será atualizado via listener
      return newSlots;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao criar disponibilidades';
      setError(errorMessage);
      throw err;
    }
  }, [agendaService]);

  const clearAvailabilityForDate = useCallback(async (date: string) => {
    try {
      await agendaService.clearAvailabilityForDate(date);
      // O estado será atualizado via listener
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao limpar disponibilidades';
      setError(errorMessage);
      throw err;
    }
  }, [agendaService]);

  const deleteAvailabilitySlot = useCallback(async (id: string) => {
    try {
      await agendaService.deleteAvailabilitySlot(id);
      // O estado será atualizado via listener
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao remover disponibilidade';
      setError(errorMessage);
      throw err;
    }
  }, [agendaService]);

  // Availability Types CRUD
  const addAvailabilityType = useCallback(async (type: Omit<AvailabilityType, 'id'>) => {
    try {
      const newType = await agendaService.createAvailabilityType(type);
      setAvailabilityTypes(prev => [...prev, newType]);
      return newType;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao criar tipo de disponibilidade';
      setError(errorMessage);
      throw err;
    }
  }, [agendaService]);

  const updateAvailabilityType = useCallback(async (id: string, updates: Partial<AvailabilityType>) => {
    try {
      const updatedType = await agendaService.updateAvailabilityType(id, updates);
      setAvailabilityTypes(prev => prev.map(type => 
        type.id === id ? updatedType : type
      ));
      return updatedType;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao atualizar tipo de disponibilidade';
      setError(errorMessage);
      throw err;
    }
  }, [agendaService]);

  const deleteAvailabilityType = useCallback(async (id: string) => {
    try {
      await agendaService.deleteAvailabilityType(id);
      setAvailabilityTypes(prev => prev.filter(type => type.id !== id));
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao remover tipo de disponibilidade';
      setError(errorMessage);
      throw err;
    }
  }, [agendaService]);

  // Settings
  const updateAgendaSettings = useCallback(async (settings: Partial<AgendaSettings>) => {
    try {
      const updatedSettings = await agendaService.updateAgendaSettings(settings);
      setAgendaSettings(updatedSettings);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao atualizar configurações';
      setError(errorMessage);
      throw err;
    }
  }, [agendaService]);

  // Utility methods
  const getAppointmentsForDate = useCallback((date: Date) => {
    return appointments.filter(appointment => 
      appointment.date.toDateString() === date.toDateString()
    );
  }, [appointments]);

  const getAvailabilityForDate = useCallback((date: Date) => {
    const dateString = date.toISOString().split('T')[0];
    return availability.filter(slot => slot.date === dateString);
  }, [availability]);

  // Refresh methods
  const refreshAppointments = useCallback(async () => {
    try {
      const appointmentsData = await agendaService.getAppointments();
      setAppointments(appointmentsData);
    } catch (err) {
      console.error('Erro ao atualizar agendamentos:', err);
    }
  }, [agendaService]);

  const refreshAvailability = useCallback(async () => {
    try {
      const availabilityData = await agendaService.getAvailabilitySlots();
      setAvailability(availabilityData);
    } catch (err) {
      console.error('Erro ao atualizar disponibilidades:', err);
    }
  }, [agendaService]);

  const contextValue: AgendaContextType = {
    // Estado
    appointments,
    availability,
    availabilityTypes,
    agendaSettings,
    loading,
    error,

    // Appointments CRUD
    addAppointment,
    updateAppointment,
    deleteAppointment,

    // Availability CRUD
    addAvailabilitySlots,
    clearAvailabilityForDate,
    deleteAvailabilitySlot,

    // Availability Types CRUD
    addAvailabilityType,
    updateAvailabilityType,
    deleteAvailabilityType,

    // Settings
    updateAgendaSettings,

    // Utility methods
    getAppointmentsForDate,
    getAvailabilityForDate,

    // Refresh methods
    refreshAppointments,
    refreshAvailability
  };

  return (
    <AgendaContext.Provider value={contextValue}>
      {children}
    </AgendaContext.Provider>
  );
};

export const useAgendaContext = () => {
  const context = useContext(AgendaContext);
  if (context === undefined) {
    throw new Error('useAgendaContext must be used within an AgendaProvider');
  }
  return context;
};