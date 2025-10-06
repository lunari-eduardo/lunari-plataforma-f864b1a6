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

const SUBSCRIPTION_DEBUG = false; // Set to true to enable detailed logging

export function useSupabaseRealtime(
  tableName: TableName,
  callbacks: RealtimeCallbacks,
  enabled: boolean = true
) {
  const generationIdRef = useRef<string>(`${tableName}_${Date.now()}_${Math.random()}`);
  const listenerIdRef = useRef<string>(generationIdRef.current);
  const isSubscribedRef = useRef<boolean>(false);
  const isMountedRef = useRef<boolean>(true);
  
  // Memoize callbacks to prevent re-subscriptions
  const memoizedCallbacks = useMemo(() => callbacks, [
    callbacks.onInsert,
    callbacks.onUpdate,
    callbacks.onDelete
  ]);

  useEffect(() => {
    isMountedRef.current = true;

    if (!enabled) {
      if (SUBSCRIPTION_DEBUG) console.log(`⏸️ [${tableName}] Subscription disabled`);
      return;
    }

    if (isSubscribedRef.current) {
      if (SUBSCRIPTION_DEBUG) console.log(`⚠️ [${tableName}] Already subscribed, skipping...`);
      return;
    }

    const listenerId = listenerIdRef.current;
    if (SUBSCRIPTION_DEBUG) console.log(`🔌 [${tableName}] Setting up subscription with ID: ${listenerId}`);
    
    const setupSubscription = async () => {
      if (!isMountedRef.current) {
        if (SUBSCRIPTION_DEBUG) console.log(`⏹️ [${tableName}] Component unmounted, aborting subscription`);
        return;
      }

      try {
        await realtimeSubscriptionManager.subscribe(
          tableName,
          memoizedCallbacks,
          listenerId
        );
        
        if (isMountedRef.current) {
          isSubscribedRef.current = true;
          if (SUBSCRIPTION_DEBUG) console.log(`✅ [${tableName}] Successfully subscribed`);
        }
      } catch (error) {
        console.error(`❌ Error setting up subscription for ${tableName}:`, error);
      }
    };

    setupSubscription();

    return () => {
      isMountedRef.current = false;
      
      if (isSubscribedRef.current) {
        if (SUBSCRIPTION_DEBUG) console.log(`🔌 [${tableName}] Cleaning up subscription: ${listenerId}`);
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