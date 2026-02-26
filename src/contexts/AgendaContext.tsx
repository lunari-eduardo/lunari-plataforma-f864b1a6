import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode, useRef } from 'react';
import { AgendaService } from '@/services/AgendaService';
import { SupabaseAgendaAdapter } from '@/adapters/SupabaseAgendaAdapter';
import { AgendaWorkflowIntegrationService } from '@/services/AgendaWorkflowIntegrationService';
import { Appointment } from '@/hooks/useAgenda';
import { AvailabilitySlot, AvailabilityType } from '@/types/availability';
import { AgendaSettings } from '@/types/agenda-supabase';
import { useAppContext } from './AppContext';
import { useAuth } from './AuthContext';
import { configurationService } from '@/services/ConfigurationService';
import { congelarRegrasPrecoFotoExtra } from '@/utils/precificacaoUtils';
import { toast } from 'sonner';
import { ProjetoService } from '@/services/ProjetoService';
import { AvailabilityService } from '@/services/AvailabilityService';
import { supabase } from '@/integrations/supabase/client';
import { addDays, format, subMonths, addMonths, startOfMonth, endOfMonth } from 'date-fns';
import { CustomTimeSlotsService } from '@/services/CustomTimeSlotsService';

interface AgendaContextType {
  // Appointments
  appointments: Appointment[];
  addAppointment: (appointmentData: Omit<Appointment, 'id'>) => Promise<Appointment>;
  updateAppointment: (id: string, updates: Partial<Appointment>) => Promise<void>;
  deleteAppointment: (id: string, preservePayments?: boolean) => Promise<void>;
  loadMonthData: (year: number, month: number) => Promise<void>;
  
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
  // Get dependencies from AppContext for integration
  const appContext = useAppContext();
  const { user } = useAuth();
  const previousUserIdRef = useRef<string | null>(null);
  
  // Track which months have been loaded
  const loadedMonthsRef = useRef<Set<string>>(new Set());
  
  // CORREÇÃO: Memoizar serviços para evitar recriação em cada render
  const agendaService = useMemo(() => {
    console.log('🔄 AgendaProvider: Creating agendaService instance');
    return new AgendaService(new SupabaseAgendaAdapter());
  }, []);
  
  // Create projeto function from service (memoized)
  const criarProjeto = useCallback((input: any) => {
    const novoProjeto = ProjetoService.criarProjeto(input);
    return novoProjeto;
  }, []);
  
  // CORREÇÃO: Memoizar integrationService com dependências mínimas
  const integrationService = useMemo(() => {
    console.log('🔄 AgendaProvider: Creating integrationService instance');
    return new AgendaWorkflowIntegrationService({
      clientes: appContext.clientes || [],
      pacotes: appContext.pacotes || [],
      produtos: appContext.produtos || [],
      configurationService,
      workflowItems: appContext.workflowItems || [],
      congelarRegrasPrecoFotoExtra,
      criarProjeto
    });
  }, [
    appContext.clientes?.length,
    appContext.pacotes?.length,
    appContext.produtos?.length,
    appContext.workflowItems?.length,
    criarProjeto
  ]);

  // State
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [availability, setAvailability] = useState<AvailabilitySlot[]>([]);
  const [availabilityTypes, setAvailabilityTypes] = useState<AvailabilityType[]>([]);
  const [settings, setSettings] = useState<AgendaSettings>({
    defaultView: 'weekly',
    workingHours: { start: '08:00', end: '18:00' },
    autoConfirmAppointments: false
  });

  // Load initial data — smart loading: current month ± 1
  const loadData = useCallback(async () => {
    try {
      const now = new Date();
      const rangeStart = format(startOfMonth(subMonths(now, 1)), 'yyyy-MM-dd');
      const rangeEnd = format(endOfMonth(addMonths(now, 1)), 'yyyy-MM-dd');
      
      console.log(`📅 [Agenda] Smart loading: ${rangeStart} → ${rangeEnd}`);
      
      const [appointmentsData, availabilityData, typesData, settingsData] = await Promise.all([
        agendaService.loadAppointmentsByRange(rangeStart, rangeEnd),
        agendaService.loadAvailabilitySlots(),
        agendaService.loadAvailabilityTypes(),
        agendaService.loadSettings()
      ]);

      setAppointments(appointmentsData);
      setAvailability(availabilityData);
      setAvailabilityTypes(typesData);
      setSettings(settingsData);
      
      // Mark loaded months
      loadedMonthsRef.current.clear();
      for (let m = -1; m <= 1; m++) {
        const d = addMonths(now, m);
        loadedMonthsRef.current.add(`${d.getFullYear()}-${d.getMonth()}`);
      }

      // Migrar horários personalizados do localStorage (uma vez)
      const hasMigrated = localStorage.getItem('custom_slots_migrated');
      if (!hasMigrated) {
        await CustomTimeSlotsService.migrateFromLocalStorage();
        localStorage.setItem('custom_slots_migrated', 'true');
      }
    } catch (error) {
      console.error('❌ Erro ao carregar dados da agenda:', error);
    }
  }, [agendaService]);

  // On-demand month loading
  const loadMonthData = useCallback(async (year: number, month: number) => {
    const key = `${year}-${month}`;
    if (loadedMonthsRef.current.has(key)) return;
    
    console.log(`📅 [Agenda] On-demand loading: ${year}-${month + 1}`);
    
    const monthDate = new Date(year, month, 1);
    const rangeStart = format(startOfMonth(monthDate), 'yyyy-MM-dd');
    const rangeEnd = format(endOfMonth(monthDate), 'yyyy-MM-dd');
    
    try {
      const newAppointments = await agendaService.loadAppointmentsByRange(rangeStart, rangeEnd);
      
      setAppointments(prev => {
        // Merge: add new appointments that don't already exist
        const existingIds = new Set(prev.map(a => a.id));
        const uniqueNew = newAppointments.filter(a => !existingIds.has(a.id));
        return [...prev, ...uniqueNew];
      });
      
      loadedMonthsRef.current.add(key);
    } catch (error) {
      console.error(`❌ Erro ao carregar mês ${year}-${month + 1}:`, error);
    }
  }, [agendaService]);

  // ✅ FASE 1: Flag para ignorar real-time durante operações manuais
  const isManualOperationRef = useRef(false);
  
  // React to auth changes + setup realtime
  useEffect(() => {
    const currentUserId = user?.id || null;
    const previousUserId = previousUserIdRef.current;
    
    // Se user não mudou, não recarregar
    if (currentUserId === previousUserId) return;
    
    previousUserIdRef.current = currentUserId;
    
    // Logout: limpar estado
    if (!currentUserId) {
      console.log('📅 [Agenda] User logged out — clearing state');
      setAppointments([]);
      setAvailability([]);
      setAvailabilityTypes([]);
      loadedMonthsRef.current.clear();
      return;
    }
    
    // Login/re-login: recarregar dados e reconectar realtime
    let cleanupRealtime: (() => void) | undefined;
    let isMounted = true;

    const setupRealtime = () => {
      const channelId = Date.now();

      const availabilityChannel = supabase
        .channel(`availability_realtime_${channelId}`)
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'availability_slots',
          filter: `user_id=eq.${currentUserId}`
        }, (payload) => {
          console.log('🔄 [Agenda] Mudança em availability_slots:', payload.eventType);
          agendaService.loadAvailabilitySlots().then(slots => {
            if (isMounted) setAvailability(slots);
          });
        })
        .subscribe((status) => {
          console.log(`📡 [Agenda] availability_slots subscription: ${status}`);
        });

      const appointmentsChannel = supabase
        .channel(`appointments_realtime_${channelId}`)
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'appointments',
          filter: `user_id=eq.${currentUserId}`
        }, (payload) => {
          if (isManualOperationRef.current) {
            console.log('🔇 [Agenda] Real-time ignorado - operação manual em andamento');
            return;
          }
          console.log('🔄 [Agenda] Mudança em appointments:', payload.eventType);
          // Reload current loaded range
          const now = new Date();
          const rangeStart = format(startOfMonth(subMonths(now, 1)), 'yyyy-MM-dd');
          const rangeEnd = format(endOfMonth(addMonths(now, 1)), 'yyyy-MM-dd');
          agendaService.loadAppointmentsByRange(rangeStart, rangeEnd).then(apps => {
            if (isMounted) setAppointments(apps);
          });
        })
        .subscribe((status) => {
          console.log(`📡 [Agenda] appointments subscription: ${status}`);
        });

      cleanupRealtime = () => {
        console.log('🧹 [Agenda] Cleaning up realtime subscriptions');
        supabase.removeChannel(availabilityChannel);
        supabase.removeChannel(appointmentsChannel);
      };
    };

    loadData();
    setupRealtime();

    return () => {
      isMounted = false;
      if (cleanupRealtime) cleanupRealtime();
    };
  }, [user?.id, agendaService, loadData]);

  // Reconexão automática quando app volta do background (PWA)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log('👁️ [Agenda] App visible - reloading data');
        loadData();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [loadData]);

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
    // ✅ FASE 1: Bloquear real-time durante operação manual
    isManualOperationRef.current = true;
    console.log('🔒 [Agenda] addAppointment - bloqueando real-time');
    
    try {
      const newAppointment = await agendaService.addAppointment(appointmentData);
      
      // ✅ FASE 1: Atualização local única (sem duplicação pelo real-time)
      setAppointments(prev => {
        // Evitar duplicatas verificando se já existe
        if (prev.some(app => app.id === newAppointment.id)) {
          console.log('⚠️ [Agenda] Appointment já existe localmente, ignorando');
          return prev;
        }
        return [...prev, newAppointment];
      });

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
    } finally {
      // ✅ FASE 1: Reabilitar real-time após delay
      setTimeout(() => {
        isManualOperationRef.current = false;
        console.log('🔓 [Agenda] addAppointment - real-time reabilitado');
      }, 1500);
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

  // ✅ FASE 4: Lock para prevenir deleções duplicadas
  const deletionInProgressRef = useRef<Set<string>>(new Set());
  
  const deleteAppointment = useCallback(async (id: string, preservePayments?: boolean) => {
    // ✅ FASE 4: Verificar se já está deletando este appointment
    if (deletionInProgressRef.current.has(id)) {
      console.warn(`⚠️ [AgendaContext] Deleção já em andamento para ${id} - ignorando chamada duplicada`);
      return;
    }
    
    // Adicionar ao lock
    deletionInProgressRef.current.add(id);
    console.log('🗑️ [AgendaContext] Iniciando deleção:', { 
      id, 
      preservePayments,
      timestamp: new Date().toISOString() 
    });
    
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
      
      console.log('✅ [AgendaContext] Deleção concluída:', { id });
    } catch (error) {
      console.error('❌ [AgendaContext] Erro ao deletar appointment:', error);
      throw error;
    } finally {
      // ✅ FASE 4: Remover do lock após um delay para evitar race conditions
      setTimeout(() => {
        deletionInProgressRef.current.delete(id);
      }, 2000);
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
    loadMonthData,
    
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