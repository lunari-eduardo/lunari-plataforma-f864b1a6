import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { WorkflowSupabaseService } from '@/services/WorkflowSupabaseService';

/**
 * Hook to automatically sync confirmed appointments with workflow sessions
 */
export const useAppointmentWorkflowSync = () => {
  
  useEffect(() => {
    // Set up real-time listener for appointment status changes
    const channel = supabase
      .channel('appointment-workflow-sync')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'appointments',
          filter: 'status=eq.confirmado'
        },
        async (payload) => {
          console.log('Appointment confirmed, creating workflow session:', payload);
          
          try {
            // Check if session already exists for this appointment
            const { data: existingSession } = await supabase
              .from('clientes_sessoes')
              .select('id')
              .eq('appointment_id', payload.new.id)
              .single();

            if (!existingSession) {
              // Create new workflow session
              await WorkflowSupabaseService.createSessionFromAppointment(
                payload.new.id,
                payload.new
              );
            }
          } catch (error) {
            console.error('Error syncing appointment to workflow:', error);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'appointments',
          filter: 'status=eq.confirmado'
        },
        async (payload) => {
          console.log('New confirmed appointment, creating workflow session:', payload);
          
          try {
            await WorkflowSupabaseService.createSessionFromAppointment(
              payload.new.id,
              payload.new
            );
          } catch (error) {
            console.error('Error syncing new appointment to workflow:', error);
          }
        }
      )
      .subscribe();

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