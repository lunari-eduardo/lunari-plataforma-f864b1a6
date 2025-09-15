import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { WorkflowSupabaseService } from '@/services/WorkflowSupabaseService';

/**
 * Hook to automatically sync confirmed appointments with workflow sessions
 * Also handles manual synchronization for existing appointments
 */
export const useAppointmentWorkflowSync = () => {
  
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
          const appointment = payload.new;
          
          console.log('📊 [AppointmentSync] Appointment status change:', {
            id: appointment.id,
            oldStatus,
            newStatus,
            hasSessionId: !!appointment.session_id
          });
          
          // Check for status transition to 'confirmado'
          if (newStatus === 'confirmado' && oldStatus !== 'confirmado') {
            console.log('🆕 [AppointmentSync] Appointment confirmed, checking for existing session...');
            
            // Check if session already exists before creating
            const { data: existingSession } = await supabase
              .from('clientes_sessoes')
              .select('id')
              .eq('user_id', appointment.user_id)
              .or(`appointment_id.eq.${appointment.id},session_id.eq.${appointment.session_id}`)
              .maybeSingle();

            if (!existingSession) {
              try {
                const newSession = await WorkflowSupabaseService.createSessionFromAppointment(appointment.id, appointment);
                console.log('✅ [AppointmentSync] Session created for confirmed appointment:', newSession?.id);
              } catch (error) {
                console.error('❌ [AppointmentSync] Error creating session from confirmed appointment:', error);
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
            
            // Check if session already exists before creating
            const { data: existingSession } = await supabase
              .from('clientes_sessoes')
              .select('id')
              .eq('user_id', appointment.user_id)
              .or(`appointment_id.eq.${appointment.id},session_id.eq.${appointment.session_id}`)
              .maybeSingle();

            if (!existingSession) {
              try {
                const newSession = await WorkflowSupabaseService.createSessionFromAppointment(appointment.id, appointment);
                console.log('✅ [AppointmentSync] Session created for new confirmed appointment:', newSession?.id);
              } catch (error) {
                console.error('❌ [AppointmentSync] Error creating session from new confirmed appointment:', error);
              }
            } else {
              console.log('ℹ️ [AppointmentSync] Session already exists for new appointment:', appointment.id);
            }
          }
        }
      )
      .subscribe();

    // Run sync for existing appointments after a delay
    setTimeout(syncExistingAppointments, 3000);

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Migrate existing localStorage data on first run
  useEffect(() => {
    const migrationKey = 'workflow_migration_completed';
    const hasRunMigration = localStorage.getItem(migrationKey);
    
    if (!hasRunMigration) {
      const runMigration = async () => {
        try {
          console.log('🔄 Starting workflow migration from localStorage to Supabase...');
          const result = await WorkflowSupabaseService.migrateLocalStorageData();
          console.log('✅ Migration completed:', result);
          
          localStorage.setItem(migrationKey, 'true');
        } catch (error) {
          console.error('❌ Migration failed:', error);
        }
      };

      // Run migration after a small delay to ensure user is authenticated
      setTimeout(runMigration, 2000);
    }
  }, []);

  return {
    // Return sync utilities if needed
    createSessionFromAppointment: WorkflowSupabaseService.createSessionFromAppointment,
    linkAppointmentToSession: WorkflowSupabaseService.linkAppointmentToSession
  };
};