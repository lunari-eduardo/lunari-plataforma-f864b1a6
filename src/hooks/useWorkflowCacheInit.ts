/**
 * useWorkflowCacheInit - Inicializa o WorkflowCacheManager
 * 
 * Responsável por:
 * 1. Configurar userId no cache manager
 * 2. Pré-carregar mês atual + anterior
 * 3. Cleanup ao deslogar
 */

import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { workflowCacheManager } from '@/services/WorkflowCacheManager';

export function useWorkflowCacheInit() {
  useEffect(() => {
    let isInitialized = false;

    const initCache = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user && !isInitialized) {
        console.log('🔄 Initializing WorkflowCacheManager for user:', user.id);
        
        // Configurar userId
        workflowCacheManager.setUserId(user.id);
        
        // Pré-carregar dados em background (não bloquear UI)
        setTimeout(() => {
          workflowCacheManager.preloadCurrentAndPreviousMonth().catch(err => {
            console.error('❌ Error preloading workflow cache:', err);
          });
        }, 1000);
        
        isInitialized = true;
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
