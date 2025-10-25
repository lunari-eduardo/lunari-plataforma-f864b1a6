import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * Hook para forçar atualização do app em todos os dispositivos do usuário
 * Escuta eventos em app_reload_events e aciona limpeza agressiva + reload
 */
export function useAppForceUpdate() {
  const [user, setUser] = useState<any>(null);
  
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
  }, []);
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    if (!user) return;

    // Subscrever a eventos de reload para este usuário
    const channel = supabase
      .channel('app-reload-events')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'app_reload_events',
          filter: `user_id=eq.${user.id}`
        },
        async (payload) => {
          console.log('🔄 [Force Update] Reload event received:', payload);
          setIsUpdating(true);
          
          // Aguardar 1s para garantir que o toast seja mostrado
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          // Executar limpeza agressiva
          await forceUnregisterAndReload();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  /**
   * Limpar todos os SWs, caches e recarregar
   */
  async function forceUnregisterAndReload() {
    try {
      console.log('🔄 [Force Update] Executando limpeza agressiva...');
      
      // 1. Unregister TODOS os Service Workers
      const registrations = await navigator.serviceWorker.getRegistrations();
      console.log(`🧹 [Force Update] Removendo ${registrations.length} service worker(s)...`);
      await Promise.all(registrations.map(registration => registration.unregister()));
      
      // 2. Limpar TODOS os caches
      const cacheNames = await caches.keys();
      console.log(`🧹 [Force Update] Limpando ${cacheNames.length} cache(s)...`);
      await Promise.all(cacheNames.map(name => caches.delete(name)));
      
      // 3. Limpar IndexedDB
      try {
        if ('databases' in indexedDB) {
          const dbs = await indexedDB.databases();
          dbs.forEach(db => {
            if (db.name && (db.name.includes('workbox') || db.name.includes('vite'))) {
              console.log(`🧹 [Force Update] Removendo IndexedDB: ${db.name}`);
              indexedDB.deleteDatabase(db.name);
            }
          });
        }
      } catch (idbError) {
        console.warn('⚠️ [Force Update] Erro ao limpar IndexedDB:', idbError);
      }
      
      console.log('✅ [Force Update] Limpeza completa, recarregando...');
      
      // 4. Hard reload (sem cache)
      window.location.reload();
    } catch (error) {
      console.error('❌ [Force Update] Erro na limpeza:', error);
      // Fallback: simple reload
      window.location.reload();
    }
  }

  /**
   * Acionar reload manualmente (para botões de admin)
   */
  async function triggerReloadForAllDevices() {
    if (!user) {
      console.warn('Usuário não autenticado');
      return false;
    }

    try {
      const { error } = await supabase
        .from('app_reload_events')
        .insert({ user_id: user.id });

      if (error) throw error;

      console.log('✅ Evento de reload disparado para todos os dispositivos');
      return true;
    } catch (error) {
      console.error('Erro ao disparar reload:', error);
      return false;
    }
  }

  return {
    isUpdating,
    triggerReloadForAllDevices,
  };
}
