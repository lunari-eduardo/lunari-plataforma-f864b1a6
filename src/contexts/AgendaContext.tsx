import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { AgendaService } from '@/services/AgendaService';
import { SupabaseAgendaAdapter } from '@/adapters/SupabaseAgendaAdapter';
import { AgendaWorkflowIntegrationService } from '@/services/AgendaWorkflowIntegrationService';
import { Appointment } from '@/hooks/useAgenda';
import { AvailabilitySlot, AvailabilityType } from '@/types/availability';
import { AgendaSettings } from '@/types/agenda-supabase';
import { useAppContext } from './AppContext';
import { configurationService } from '@/services/ConfigurationService';
import { congelarRegrasPrecoFotoExtra } from '@/utils/precificacaoUtils';
import { toast } from 'sonner';
import { ProjetoService } from '@/services/ProjetoService';
import { AvailabilityService } from '@/services/AvailabilityService';
import { supabase } from '@/integrations/supabase/client';
import { addDays, format } from 'date-fns';
import { CustomTimeSlotsService } from '@/services/CustomTimeSlotsService';

interface AgendaContextType {
  // Appointments
  appointments: Appointment[];
  addAppointment: (appointmentData: Omit<Appointment, 'id'>) => Promise<Appointment>;
  updateAppointment: (id: string, updates: Partial<Appointment>) => Promise<void>;
  deleteAppointment: (id: string, preservePayments?: boolean) => Promise<void>;
  
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
  const agendaService = new AgendaService(new SupabaseAgendaAdapter());
  
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

  // Load initial data + FASE 1: Real-time subscriptions
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

        // Migrar horários personalizados do localStorage (uma vez)
        const hasMigrated = localStorage.getItem('custom_slots_migrated');
        if (!hasMigrated) {
          await CustomTimeSlotsService.migrateFromLocalStorage();
          localStorage.setItem('custom_slots_migrated', 'true');
        }
      } catch (error) {
        console.error('❌ Erro ao carregar dados da agenda:', error);
      }
    };

    loadData();

    // FASE 1: Subscrever a mudanças em tempo real
    const availabilityChannel = supabase
      .channel('availability_realtime')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'availability_slots'
      }, (payload) => {
        console.log('🔄 Mudança detectada em availability_slots:', payload);
        
        // Recarregar availability slots
        agendaService.loadAvailabilitySlots().then(slots => {
          setAvailability(slots);
        });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(availabilityChannel);
    };
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

  // FASE 3: Função auxiliar para encontrar próximo slot disponível
  const findNextAvailableSlot = useCallback(async (
    fromDate: Date, 
    fromTime: string
  ): Promise<{ date: Date; time: string } | null> => {
    const availabilitySlots = await agendaService.loadAvailabilitySlots();
    const currentAppointments = await agendaService.loadAppointments();
    
    // Procurar nos próximos 30 dias
    for (let i = 0; i < 30; i++) {
      const checkDate = addDays(fromDate, i);
      const dateStr = format(checkDate, 'yyyy-MM-dd');
      
      // Slots disponíveis neste dia
      const daySlots = availabilitySlots.filter(slot => slot.date === dateStr);
      
      for (const slot of daySlots) {
        // Verificar se há conflito com agendamento confirmado
        const hasConflict = currentAppointments.some(app =>
          app.status === 'confirmado' &&
          app.date.toDateString() === checkDate.toDateString() &&
          app.time === slot.time
        );
        
        if (!hasConflict) {
          return { date: checkDate, time: slot.time };
        }
      }
    }
    
    return null;
  }, []);

  // Appointment operations - FASE 2 e 3
  const addAppointment = useCallback(async (appointmentData: Omit<Appointment, 'id'>) => {
    try {
      const newAppointment = await agendaService.addAppointment(appointmentData);
      setAppointments(prev => [...prev, newAppointment]);

      // FASE 2: Se agendamento confirmado, ocupar slot
      if (newAppointment.status === 'confirmado') {
        await AvailabilityService.occupyAvailableSlot(
          newAppointment.date, 
          newAppointment.time
        );
      }

      return newAppointment;
    } catch (error) {
      console.error('❌ Erro ao adicionar appointment:', error);
      throw error;
    }
  }, []);

  const updateAppointment = useCallback(async (id: string, updates: Partial<Appointment>) => {
    try {
      const currentAppointment = appointments.find(app => app.id === id);
      
      await agendaService.updateAppointment(id, updates);
      
      const wasNotConfirmed = currentAppointment?.status !== 'confirmado';
      const nowConfirmed = updates.status === 'confirmado';
      
      if (wasNotConfirmed && nowConfirmed && currentAppointment) {
        // FASE 2: Ocupar slot quando confirmar
        await AvailabilityService.occupyAvailableSlot(
          currentAppointment.date,
          currentAppointment.time
        );

        // FASE 3: Resolver conflitos automaticamente
        const conflictingAppointments = appointments.filter(app => 
          app.id !== id &&
          app.status === 'a confirmar' &&
          app.date.toDateString() === currentAppointment.date.toDateString() &&
          app.time === currentAppointment.time
        );

        if (conflictingAppointments.length > 0) {
          console.log(`🔄 Detectados ${conflictingAppointments.length} conflitos. Resolvendo...`);
          
          for (const conflictingApp of conflictingAppointments) {
            // Buscar próximo slot disponível
            const nextSlot = await findNextAvailableSlot(
              conflictingApp.date,
              conflictingApp.time
            );

            if (nextSlot) {
              // Reagendar
              await agendaService.updateAppointment(conflictingApp.id, {
                date: nextSlot.date,
                time: nextSlot.time,
                description: `${conflictingApp.description || ''} (Reagendado automaticamente)`.trim()
              });
              console.log(`✅ Agendamento ${conflictingApp.id} reagendado para ${format(nextSlot.date, 'dd/MM/yyyy')} às ${nextSlot.time}`);
            } else {
              // Sem slots disponíveis - manter como pendente com aviso
              await agendaService.updateAppointment(conflictingApp.id, {
                description: `${conflictingApp.description || ''} (ATENÇÃO: Precisa reagendar - conflito)`.trim()
              });
              console.warn(`⚠️ Agendamento ${conflictingApp.id} não pôde ser reagendado automaticamente`);
            }
          }
        }
      }
      
      // Recarregar appointments para refletir mudanças
      const updatedAppointments = await agendaService.loadAppointments();
      setAppointments(updatedAppointments);
      
    } catch (error) {
      console.error('❌ Erro ao atualizar appointment:', error);
      throw error;
    }
  }, [appointments, findNextAvailableSlot]);

  const deleteAppointment = useCallback(async (id: string, preservePayments?: boolean) => {
    try {
      // FASE 2: Buscar dados antes de deletar
      const appointment = appointments.find(app => app.id === id);
      
      await agendaService.deleteAppointment(id, preservePayments);
      
      // FASE 2: Liberar slot se era confirmado (opcional - comentado)
      // if (appointment?.status === 'confirmado') {
      //   await AvailabilityService.releaseSlot(
      //     appointment.date,
      //     appointment.time
      //   );
      // }
      
      setAppointments(prev => prev.filter(app => app.id !== id));
    } catch (error) {
      console.error('❌ Erro ao deletar appointment:', error);
      throw error;
    }
  }, [appointments]);

  // Availability operations
  const addAvailabilitySlots = useCallback(async (slots: Omit<AvailabilitySlot, 'id'>[]) => {
    try {
      console.log('🔄 [AgendaContext] Adicionando slots:', slots);
      
      await agendaService.addAvailabilitySlots(slots);
      
      console.log('✅ [AgendaContext] Slots salvos, recarregando...');
      const updatedSlots = await agendaService.loadAvailabilitySlots();
      
      console.log(`✅ [AgendaContext] ${updatedSlots.length} slots carregados`);
      setAvailability(updatedSlots);
    } catch (error) {
      console.error('❌ Erro ao adicionar availability slots:', error);
      toast.error('Erro ao salvar horários de disponibilidade');
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