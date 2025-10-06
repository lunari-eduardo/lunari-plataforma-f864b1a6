/**
 * Hook for real-time Supabase subscriptions using singleton manager
 * Prevents duplicate subscriptions and optimizes reconnection logic
 */

import { useEffect, useMemo, useRef } from 'react';
import { realtimeSubscriptionManager } from '@/services/RealtimeSubscriptionManager';

type TableName = 'categorias' | 'pacotes' | 'produtos' | 'etapas_trabalho' | 'clientes' | 'clientes_familia' | 'clientes_documentos' | 'appointments' | 'clientes_sessoes' | 'clientes_transacoes';

interface RealtimeCallbacks {
  onInsert?: (payload: any) => void;
  onUpdate?: (payload: any) => void;
  onDelete?: (payload: any) => void;
}

export function useSupabaseRealtime(
  tableName: TableName,
  callbacks: RealtimeCallbacks,
  enabled: boolean = true
) {
  const listenerIdRef = useRef<string>(`${tableName}_${Date.now()}_${Math.random()}`);
  const isSubscribedRef = useRef<boolean>(false);
  
  // Memoize callbacks to prevent re-subscriptions
  const memoizedCallbacks = useMemo(() => callbacks, [
    callbacks.onInsert,
    callbacks.onUpdate,
    callbacks.onDelete
  ]);

  useEffect(() => {
    if (!enabled || isSubscribedRef.current) return;

    const listenerId = listenerIdRef.current;
    
    const setupSubscription = async () => {
      try {
        await realtimeSubscriptionManager.subscribe(
          tableName,
          memoizedCallbacks,
          listenerId
        );
        isSubscribedRef.current = true;
      } catch (error) {
        console.error(`❌ Error setting up subscription for ${tableName}:`, error);
      }
    };

    setupSubscription();

    return () => {
      if (isSubscribedRef.current) {
        realtimeSubscriptionManager.unsubscribe(tableName, listenerId);
        isSubscribedRef.current = false;
      }
    };
  }, [tableName, memoizedCallbacks, enabled]);

  return {
    cleanup: async () => {
      if (isSubscribedRef.current) {
        await realtimeSubscriptionManager.unsubscribe(tableName, listenerIdRef.current);
        isSubscribedRef.current = false;
      }
    }
  };
}