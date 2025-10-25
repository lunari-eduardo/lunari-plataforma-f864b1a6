/**
 * useWorkflowCacheInit - Inicializa o WorkflowCacheManager
 * 
 * Responsável por:
 * 1. Configurar userId no cache manager
 * 2. Pré-carregar mês atual + anterior
 * 3. FASE 5: Sincronizar appointments existentes (uma única vez)
 * 4. Cleanup ao deslogar
 */

import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { workflowCacheManager } from '@/services/WorkflowCacheManager';
import { WorkflowSupabaseService } from '@/services/WorkflowSupabaseService';

export function useWorkflowCacheInit() {
  useEffect(() => {
    let isInitialized = false;

    const initCache = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user && !isInitialized) {
        console.log('🔄 Initializing WorkflowCacheManager for user:', user.id);
        
        // Configurar userId
        workflowCacheManager.setUserId(user.id);
        
        // ✅ CORREÇÃO: Sempre sincronizar appointments ao montar (idempotente)
        // Remover gate de sessionStorage que bloqueava novas abas/PWA
        setTimeout(async () => {
          try {
            console.log('🔄 [WorkflowCacheInit] Syncing existing appointments...');
            await syncExistingAppointments();
            console.log('✅ [WorkflowCacheInit] Appointments sync completed');
            
            // ✅ FASE 3: Reparar divergências retroativas (uma única vez por mount)
            console.log('🔧 [WorkflowCacheInit] Running repair for date/time mismatches...');
            await WorkflowSupabaseService.repairAppointmentsSessionsMismatch();
            console.log('✅ [WorkflowCacheInit] Repair completed');
          } catch (error) {
            console.error('❌ [WorkflowCacheInit] Error syncing/repairing:', error);
          }
        }, 2000);
        
        // Pré-carregar dados em background (não bloquear UI)
        setTimeout(() => {
          workflowCacheManager.preloadCurrentAndPreviousMonth().catch(err => {
            console.error('❌ Error preloading workflow cache:', err);
          });
        }, 1000);
        
        isInitialized = true;
      }
    };

    // FASE 5: Função de sincronização de appointments (extraída do useAppointmentWorkflowSync)
    const syncExistingAppointments = async () => {
      try {
        const { data: user } = await supabase.auth.getUser();
        if (!user?.user) return;

        const { data: appointments } = await supabase
          .from('appointments')
          .select('*')
          .eq('user_id', user.user.id)
          .eq('status', 'confirmado');

        if (!appointments?.length) return;

        const appointmentsNeedingSync = [];
        for (const appointment of appointments) {
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

        for (const appointment of appointmentsNeedingSync) {
          try {
            await WorkflowSupabaseService.createSessionFromAppointment(
              appointment.id,
              appointment
            );
          } catch (error) {
            console.error(`❌ Error creating session for appointment ${appointment.id}:`, error);
          }
        }
      } catch (error) {
        console.error('❌ Error syncing existing appointments:', error);
      }
    };

    initCache();

    // Listener para mudanças de auth
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        console.log('🔄 User signed in, initializing cache');
        workflowCacheManager.setUserId(session.user.id);
        
        setTimeout(() => {
          workflowCacheManager.preloadCurrentAndPreviousMonth().catch(err => {
            console.error('❌ Error preloading workflow cache:', err);
          });
        }, 1000);
      } else if (event === 'SIGNED_OUT') {
        console.log('🧹 User signed out, cleaning up cache');
        workflowCacheManager.cleanup();
        isInitialized = false;
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);
}
