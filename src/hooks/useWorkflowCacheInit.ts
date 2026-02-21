/**
 * useWorkflowCacheInit - Inicializa o WorkflowCacheManager
 * 
 * Responsável por:
 * 1. Configurar userId no cache manager
 * 2. Pré-carregar mês atual + anterior
 * 3. FASE 5: Sincronizar appointments existentes (uma única vez)
 * 4. Cleanup ao deslogar
 */

import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { workflowCacheManager } from '@/services/WorkflowCacheManager';
import { WorkflowSupabaseService } from '@/services/WorkflowSupabaseService';

export function useWorkflowCacheInit() {
  useEffect(() => {
    let isInitialized = false;

    const initCache = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      
      if (user && !isInitialized) {
        console.log('🔄 Initializing WorkflowCacheManager for user:', user.id);
        
        // ✅ Limpar cache antigo corrompido (uma vez)
        const cacheVersion = localStorage.getItem('workflow_cache_version');
        if (cacheVersion !== '2.0') {
          console.log('🗑️ Clearing old corrupted cache...');
          workflowCacheManager.clearAllCache();
          localStorage.removeItem('workflow-cache');
          localStorage.setItem('workflow_cache_version', '2.0');
        }
        
        // 1. Configurar userId
        workflowCacheManager.setUserId(user.id);
        
        // 2. Executar preload em background (NÃO BLOQUEAR)
        workflowCacheManager.preloadWorkflowRange()
          .then(() => {
            console.log('✅ WorkflowCacheManager: Preload completed in background');
          })
          .catch(err => {
            console.error('❌ Preload failed (non-fatal):', err);
          });
        
        // 3. Sincronizar appointments em background (não bloqueia)
        setTimeout(async () => {
          try {
            console.log('🔄 [WorkflowCacheInit] Syncing existing appointments...');
            await syncExistingAppointments(user.id);
            console.log('✅ [WorkflowCacheInit] Appointments sync completed');
            
            // Reparar divergências retroativas (uma única vez por mount)
            console.log('🔧 [WorkflowCacheInit] Running repair for date/time mismatches...');
            await WorkflowSupabaseService.repairAppointmentsSessionsMismatch();
            console.log('✅ [WorkflowCacheInit] Repair completed');
          } catch (error) {
            console.error('❌ [WorkflowCacheInit] Error syncing/repairing:', error);
          }
        }, 3000);
        
        isInitialized = true;
      }
    };

    // ✅ OPTIMIZED: Batch query instead of N+1
    const syncExistingAppointments = async (userId: string) => {
      try {
        // 1. Buscar todos os appointments confirmados
        const { data: appointments } = await supabase
          .from('appointments')
          .select('*')
          .eq('user_id', userId)
          .eq('status', 'confirmado');

        if (!appointments?.length) return;

        // 2. Buscar TODAS as sessões existentes em 1 query (batch)
        const appointmentIds = appointments.map(a => a.id);
        const { data: existingSessions } = await supabase
          .from('clientes_sessoes')
          .select('appointment_id')
          .eq('user_id', userId)
          .in('appointment_id', appointmentIds);

        const existingSet = new Set(existingSessions?.map(s => s.appointment_id) || []);
        const appointmentsNeedingSync = appointments.filter(a => !existingSet.has(a.id));

        if (appointmentsNeedingSync.length === 0) return;

        console.log(`📋 [WorkflowCacheInit] ${appointmentsNeedingSync.length} appointments need sync`);

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
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        console.log('🔄 User signed in, initializing cache');
        workflowCacheManager.setUserId(session.user.id);
        
        // Preload em background (não bloqueia)
        workflowCacheManager.preloadWorkflowRange()
          .then(() => console.log('✅ Cache preload completed'))
          .catch(err => console.error('❌ Cache preload failed:', err));
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
