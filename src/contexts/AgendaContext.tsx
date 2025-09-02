import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { AgendaService } from '@/services/AgendaService';
import { LocalStorageAgendaAdapter } from '@/adapters/LocalStorageAgendaAdapter';
import { AgendaWorkflowIntegrationService } from '@/services/AgendaWorkflowIntegrationService';
import { Appointment } from '@/hooks/useAgenda';
import { AvailabilitySlot, AvailabilityType } from '@/types/availability';
import { AgendaSettings } from '@/types/agenda-supabase';
import { useAppContext } from './AppContext';
import { configurationService } from '@/services/ConfigurationService';
import { congelarRegrasPrecoFotoExtra } from '@/utils/precificacaoUtils';
import { ProjetoService } from '@/services/ProjetoService';

interface AgendaContextType {
  // Appointments
  appointments: Appointment[];
  addAppointment: (appointmentData: Omit<Appointment, 'id'>) => Promise<Appointment>;
  updateAppointment: (id: string, updates: Partial<Appointment>) => Promise<void>;
  deleteAppointment: (id: string) => Promise<void>;
  
  // Availability
  availability: AvailabilitySlot[];
  availabilityTypes: AvailabilityType[];
  addAvailabilitySlots: (slots: Omit<AvailabilitySlot, 'id'>[]) => Promise<void>;
  clearAvailabilityForDate: (date: string) => Promise<void>;
  deleteAvailabilitySlot: (id: string) => Promise<void>;
  addAvailabilityType: (type: Omit<AvailabilityType, 'id'>) => Promise<AvailabilityType>;
  updateAvailabilityType: (id: string, updates: Partial<AvailabilityType>) => Promise<void>;
  deleteAvailabilityType: (id: string) => Promise<void>;
  
  // Settings
  settings: AgendaSettings;
  updateSettings: (settings: AgendaSettings) => Promise<void>;
  
  // Integration functions
  getConfirmedSessionsForWorkflow: (
    month?: number, 
    year?: number, 
    getClienteByName?: (nome: string) => any, 
    pacotesData?: any[], 
    produtosData?: any[]
  ) => any[];
}

const AgendaContext = createContext<AgendaContextType | undefined>(undefined);

interface AgendaProviderProps {
  children: ReactNode;
}

export const AgendaProvider: React.FC<AgendaProviderProps> = ({ children }) => {
  // Services
  const agendaService = new AgendaService(new LocalStorageAgendaAdapter());
  
  // Get dependencies from AppContext for integration
  const appContext = useAppContext();
  
  // Create projeto function from service
  const criarProjeto = (input: any) => {
    const novoProjeto = ProjetoService.criarProjeto(input);
    // The project creation will handle its own persistence
    return novoProjeto;
  };
  
  const integrationService = new AgendaWorkflowIntegrationService({
    clientes: appContext.clientes || [],
    pacotes: appContext.pacotes || [],
    produtos: appContext.produtos || [],
    configurationService,
    workflowItems: appContext.workflowItems || [],
    congelarRegrasPrecoFotoExtra,
    criarProjeto
  });

  // State
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [availability, setAvailability] = useState<AvailabilitySlot[]>([]);
  const [availabilityTypes, setAvailabilityTypes] = useState<AvailabilityType[]>([]);
  const [settings, setSettings] = useState<AgendaSettings>({
    defaultView: 'weekly',
    workingHours: { start: '08:00', end: '18:00' },
    autoConfirmAppointments: false
  });

  // Load initial data
  useEffect(() => {
    const loadData = async () => {
      try {
        const [appointmentsData, availabilityData, typesData, settingsData] = await Promise.all([
          agendaService.loadAppointments(),
          agendaService.loadAvailabilitySlots(),
          agendaService.loadAvailabilityTypes(),
          agendaService.loadSettings()
        ]);

        setAppointments(appointmentsData);
        setAvailability(availabilityData);
        setAvailabilityTypes(typesData);
        setSettings(settingsData);
      } catch (error) {
        console.error('❌ Erro ao carregar dados da agenda:', error);
      }
    };

    loadData();
  }, []);

  // Critical: Convert confirmed appointments to workflow items
  useEffect(() => {
    if (appointments.length > 0 && appContext.workflowItems) {
      try {
        integrationService.convertConfirmedAppointmentsToWorkflow(appointments);
      } catch (error) {
        console.error('❌ Erro na integração Agenda→Workflow:', error);
      }
    }
  }, [appointments.length, appContext.workflowItems?.length]);

  // Appointment operations
  const addAppointment = useCallback(async (appointmentData: Omit<Appointment, 'id'>) => {
    try {
      const newAppointment = await agendaService.addAppointment(appointmentData);
      setAppointments(prev => [...prev, newAppointment]);
      return newAppointment;
    } catch (error) {
      console.error('❌ Erro ao adicionar appointment:', error);
      throw error;
    }
  }, []);

  const updateAppointment = useCallback(async (id: string, updates: Partial<Appointment>) => {
    try {
      await agendaService.updateAppointment(id, updates);
      setAppointments(prev => prev.map(app => 
        app.id === id ? { ...app, ...updates } : app
      ));
    } catch (error) {
      console.error('❌ Erro ao atualizar appointment:', error);
      throw error;
    }
  }, []);

  const deleteAppointment = useCallback(async (id: string) => {
    try {
      await agendaService.deleteAppointment(id);
      setAppointments(prev => prev.filter(app => app.id !== id));
    } catch (error) {
      console.error('❌ Erro ao deletar appointment:', error);
      throw error;
    }
  }, []);

  // Availability operations
  const addAvailabilitySlots = useCallback(async (slots: Omit<AvailabilitySlot, 'id'>[]) => {
    try {
      await agendaService.addAvailabilitySlots(slots);
      const updatedSlots = await agendaService.loadAvailabilitySlots();
      setAvailability(updatedSlots);
    } catch (error) {
      console.error('❌ Erro ao adicionar availability slots:', error);
      throw error;
    }
  }, []);

  const clearAvailabilityForDate = useCallback(async (date: string) => {
    try {
      await agendaService.clearAvailabilityForDate(date);
      setAvailability(prev => prev.filter(slot => slot.date !== date));
    } catch (error) {
      console.error('❌ Erro ao limpar availability:', error);
      throw error;
    }
  }, []);

  const deleteAvailabilitySlot = useCallback(async (id: string) => {
    try {
      await agendaService.deleteAvailabilitySlot(id);
      setAvailability(prev => prev.filter(slot => slot.id !== id));
    } catch (error) {
      console.error('❌ Erro ao deletar availability slot:', error);
      throw error;
    }
  }, []);

  // Availability types operations
  const addAvailabilityType = useCallback(async (typeData: Omit<AvailabilityType, 'id'>) => {
    try {
      const newType = await agendaService.addAvailabilityType(typeData);
      setAvailabilityTypes(prev => [...prev, newType]);
      return newType;
    } catch (error) {
      console.error('❌ Erro ao adicionar availability type:', error);
      throw error;
    }
  }, []);

  const updateAvailabilityType = useCallback(async (id: string, updates: Partial<AvailabilityType>) => {
    try {
      await agendaService.updateAvailabilityType(id, updates);
      setAvailabilityTypes(prev => prev.map(type => 
        type.id === id ? { ...type, ...updates } : type
      ));
    } catch (error) {
      console.error('❌ Erro ao atualizar availability type:', error);
      throw error;
    }
  }, []);

  const deleteAvailabilityType = useCallback(async (id: string) => {
    try {
      await agendaService.deleteAvailabilityType(id);
      setAvailabilityTypes(prev => prev.filter(type => type.id !== id));
    } catch (error) {
      console.error('❌ Erro ao deletar availability type:', error);
      throw error;
    }
  }, []);

  // Settings operations
  const updateSettings = useCallback(async (newSettings: AgendaSettings) => {
    try {
      await agendaService.saveSettings(newSettings);
      setSettings(newSettings);
    } catch (error) {
      console.error('❌ Erro ao salvar settings:', error);
      throw error;
    }
  }, []);

  // Integration function - preserves original behavior
  const getConfirmedSessionsForWorkflow = useCallback((
    month?: number, 
    year?: number, 
    getClienteByName?: (nome: string) => any, 
    pacotesData?: any[], 
    produtosData?: any[]
  ) => {
    return integrationService.getConfirmedSessionsForWorkflow(
      appointments, 
      month, 
      year, 
      getClienteByName, 
      pacotesData, 
      produtosData
    );
  }, [appointments]);

  const value: AgendaContextType = {
    // Appointments
    appointments,
    addAppointment,
    updateAppointment,
    deleteAppointment,
    
    // Availability
    availability,
    availabilityTypes,
    addAvailabilitySlots,
    clearAvailabilityForDate,
    deleteAvailabilitySlot,
    addAvailabilityType,
    updateAvailabilityType,
    deleteAvailabilityType,
    
    // Settings
    settings,
    updateSettings,
    
    // Integration
    getConfirmedSessionsForWorkflow
  };

  return (
    <AgendaContext.Provider value={value}>
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