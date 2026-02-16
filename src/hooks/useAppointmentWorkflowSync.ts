import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { WorkflowSupabaseService } from '@/services/WorkflowSupabaseService';

/**
 * Hook to automatically sync confirmed appointments with workflow sessions
 * Also handles manual synchronization for existing appointments
 * 
 * ✅ FASE 3: Este é o ÚNICO ponto de criação de sessões (unificado)
 */
export const useAppointmentWorkflowSync = () => {
  // ✅ FASE 3: Lock para prevenir criação duplicada de sessões
  const sessionCreationInProgress = useRef<Set<string>>(new Set());
  
  // Function to manually sync existing confirmed appointments
  const syncExistingAppointments = async () => {
    try {
      console.log('🔄 [AppointmentSync] Starting manual sync of existing appointments...');
      
      // Skip localStorage gate - always check for appointments to sync
      console.log('🔍 [AppointmentSync] Checking for confirmed appointments without sessions...');

      // Get current user
      const { data: user } = await supabase.auth.getUser();
      if (!user?.user) {
        console.log('❌ [AppointmentSync] User not authenticated, skipping sync');
        return;
      }

      // Buscar agendamentos confirmados que não possuem sessão no workflow
      const { data: appointments, error: appointmentsError } = await supabase
        .from('appointments')
        .select('*')
        .eq('user_id', user.user.id)
        .eq('status', 'confirmado');

      if (appointmentsError) {
        console.error('❌ [AppointmentSync] Error fetching appointments:', appointmentsError);
        return;
      }

      // Filter to only appointments that don't have corresponding sessions
      const appointmentsNeedingSync = [];
      if (appointments && appointments.length > 0) {
        for (const appointment of appointments) {
          // Check if this appointment already has a session
          const { data: existingSession } = await supabase
            .from('clientes_sessoes')
            .select('id')
            .eq('user_id', user.user.id)
            .or(`appointment_id.eq.${appointment.id},session_id.eq.${appointment.session_id}`)
            .maybeSingle();

          if (!existingSession) {
            appointmentsNeedingSync.push(appointment);
          }
        }
      }

      console.log(`📋 [AppointmentSync] Found ${appointmentsNeedingSync.length} confirmed appointments without sessions`);

      if (appointmentsNeedingSync.length === 0) {
        console.log('✅ [AppointmentSync] No appointments to sync');
        return;
      }

      // Create sessions for appointments that don't have them
      for (const appointment of appointmentsNeedingSync) {
        console.log(`📝 [AppointmentSync] Creating session for appointment ${appointment.id}`);
        
        try {
          await WorkflowSupabaseService.createSessionFromAppointment(
            appointment.id,
            appointment
          );
          console.log(`✅ [AppointmentSync] Successfully created session for appointment ${appointment.id}`);
        } catch (error) {
          console.error(`❌ [AppointmentSync] Error creating session for appointment ${appointment.id}:`, error);
        }
      }

      console.log('✅ [AppointmentSync] Manual sync completed successfully');
    } catch (error) {
      console.error('❌ [AppointmentSync] Error syncing existing appointments:', error);
    }
  };

  useEffect(() => {
    // Set up real-time listener for appointment status changes
    const channel = supabase
      .channel('appointment-workflow-sync')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'appointments'
        },
        async (payload) => {
          console.log('🔔 [AppointmentSync] Real-time appointment change detected:', payload.eventType, payload);
          
          const oldStatus = payload.old?.status;
          const newStatus = payload.new?.status;
          const oldDate = payload.old?.date;
          const newDate = payload.new?.date;
          const oldTime = payload.old?.time;
          const newTime = payload.new?.time;
          const appointment = payload.new;
          
          console.log('📊 [AppointmentSync] Appointment change:', {
            id: appointment.id,
            oldStatus,
            newStatus,
            dateChanged: oldDate !== newDate,
            timeChanged: oldTime !== newTime,
            hasSessionId: !!appointment.session_id
          });

          // Check for date/time changes on confirmed appointments
          if (newStatus === 'confirmado' && (oldDate !== newDate || oldTime !== newTime)) {
            console.log('📅 [AppointmentSync] Date/time changed for confirmed appointment - database trigger will sync automatically');
          }
          
          // Check for status transition to 'confirmado'
          if (newStatus === 'confirmado' && oldStatus !== 'confirmado') {
            console.log('🆕 [AppointmentSync] Appointment confirmed, checking for existing session...');
            
            // ✅ FASE 3: Verificar lock antes de criar
            if (sessionCreationInProgress.current.has(appointment.id)) {
              console.log('⚠️ [AppointmentSync] Criação já em andamento para:', appointment.id);
              return;
            }
            
            // Check if session already exists before creating
            const { data: existingSession } = await supabase
              .from('clientes_sessoes')
              .select('id')
              .eq('user_id', appointment.user_id)
              .eq('appointment_id', appointment.id) // ✅ FASE 3: Busca apenas por appointment_id (mais seguro)
              .maybeSingle();

            if (!existingSession) {
              // ✅ FASE 3: Adicionar ao lock
              sessionCreationInProgress.current.add(appointment.id);
              
              try {
                const newSession = await WorkflowSupabaseService.createSessionFromAppointment(appointment.id, appointment);
                console.log('✅ [AppointmentSync] Session created for confirmed appointment:', newSession?.id);
                
                // FASE 5: Invalidar cache e adicionar nova sessão
                if (newSession) {
                  const sessionDate = new Date(newSession.data_sessao);
                  const year = sessionDate.getFullYear();
                  const month = sessionDate.getMonth() + 1;
                  
                  // 1. Merge otimista (UI instantânea)
                  window.dispatchEvent(new CustomEvent('workflow-cache-merge', {
                    detail: { session: newSession }
                  }));
                  console.log('💾 [AppointmentSync] Session merged to cache:', newSession.id);
                  
                  // 2. Silent refresh em background (garantia de consistência)
                  setTimeout(() => {
                    window.dispatchEvent(new CustomEvent('workflow-cache-silent-refresh', {
                      detail: { year, month }
                    }));
                    console.log('🔇 [AppointmentSync] Silent refresh dispatched for', year, month);
                  }, 500);
                  
                  // 3. Evento de criação para outros listeners
                  window.dispatchEvent(new CustomEvent('workflow-session-created', {
                    detail: { 
                      sessionId: newSession.id,
                      sessionIdText: newSession.session_id,
                      appointmentId: appointment.id,
                      year,
                      month,
                      timestamp: new Date().toISOString()
                    }
                  }));
                  console.log('📢 [AppointmentSync] Session created event dispatched');
                }
              } catch (error) {
                console.error('❌ [AppointmentSync] Error creating session from confirmed appointment:', error);
              } finally {
                // ✅ FASE 3: Remover do lock após delay
                setTimeout(() => {
                  sessionCreationInProgress.current.delete(appointment.id);
                }, 3000);
              }
            } else {
              console.log('ℹ️ [AppointmentSync] Session already exists for appointment:', appointment.id);
            }
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'appointments'
        },
        async (payload) => {
          console.log('🔔 [AppointmentSync] New appointment inserted:', payload.eventType, payload);
          
          const appointment = payload.new;
          console.log('📊 [AppointmentSync] New appointment inserted:', appointment.id, 'status:', appointment.status);
          
          // Check if new appointment is already confirmed and needs a session
          if (appointment.status === 'confirmado') {
            console.log('🆕 [AppointmentSync] New confirmed appointment, checking for existing session...');
            
            // ✅ FASE 3: Verificar lock antes de criar
            if (sessionCreationInProgress.current.has(appointment.id)) {
              console.log('⚠️ [AppointmentSync] Criação já em andamento para novo appointment:', appointment.id);
              return;
            }
            
            // Check if session already exists before creating
            const { data: existingSession } = await supabase
              .from('clientes_sessoes')
              .select('id')
              .eq('user_id', appointment.user_id)
              .eq('appointment_id', appointment.id) // ✅ FASE 3: Busca apenas por appointment_id (mais seguro)
              .maybeSingle();

            if (!existingSession) {
              // ✅ FASE 3: Adicionar ao lock
              sessionCreationInProgress.current.add(appointment.id);
              
              try {
                const newSession = await WorkflowSupabaseService.createSessionFromAppointment(appointment.id, appointment);
                console.log('✅ [AppointmentSync] Session created for new confirmed appointment:', newSession?.id);
                
                // FASE 5: Adicionar nova sessão ao cache
                if (newSession) {
                  const sessionDate = new Date(newSession.data_sessao);
                  const year = sessionDate.getFullYear();
                  const month = sessionDate.getMonth() + 1;
                  
                  // 1. Merge otimista (UI instantânea)
                  window.dispatchEvent(new CustomEvent('workflow-cache-merge', {
                    detail: { session: newSession }
                  }));
                  console.log('💾 [AppointmentSync] Session merged to cache:', newSession.id);
                  
                  // 2. Silent refresh em background (garantia de consistência)
                  setTimeout(() => {
                    window.dispatchEvent(new CustomEvent('workflow-cache-silent-refresh', {
                      detail: { year, month }
                    }));
                    console.log('🔇 [AppointmentSync] Silent refresh dispatched for', year, month);
                  }, 500);
                  
                  // 3. Evento de criação para outros listeners
                  window.dispatchEvent(new CustomEvent('workflow-session-created', {
                    detail: { 
                      sessionId: newSession.id,
                      sessionIdText: newSession.session_id,
                      appointmentId: appointment.id,
                      year,
                      month,
                      timestamp: new Date().toISOString()
                    }
                  }));
                  console.log('📢 [AppointmentSync] Session created event dispatched');
                }
              } catch (error) {
                console.error('❌ [AppointmentSync] Error creating session from new confirmed appointment:', error);
              } finally {
                // ✅ FASE 3: Remover do lock após delay
                setTimeout(() => {
                  sessionCreationInProgress.current.delete(appointment.id);
                }, 3000);
              }
            } else {
              console.log('ℹ️ [AppointmentSync] Session already exists for new appointment:', appointment.id);
            }
          }
        }
      )
      .subscribe();

    // FASE 5: Removido setTimeout - sync será executado apenas no mount do App via useWorkflowCacheInit

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Migração localStorage → Supabase removida permanentemente
  // O sistema é 100% Supabase, migração legada causava duplicações

  return {
    // Return sync utilities if needed
    createSessionFromAppointment: WorkflowSupabaseService.createSessionFromAppointment,
    linkAppointmentToSession: WorkflowSupabaseService.linkAppointmentToSession,
    syncExistingAppointments // FASE 5: Exportar para usar no useWorkflowCacheInit
  };
};