/**
 * Hook for real-time Supabase subscriptions
 * Handles live data synchronization for all configuration tables
 */

import { useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { RealtimeChannel } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';

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
  const channelRef = useRef<RealtimeChannel | null>(null);
  const subscribedRef = useRef<boolean>(false);

  const setupRealtime = useCallback(async (retryCount = 0) => {
    if (!enabled) return;
    if (subscribedRef.current) {
      console.log(`✅ Already subscribed to ${tableName}, skipping setup`);
      return;
    }
    try {
      // Check if user is authenticated
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.log(`🔄 User not authenticated, skipping realtime for ${tableName}`);
        return;
      }

      // Remove existing channel if any
      if (channelRef.current) {
        await supabase.removeChannel(channelRef.current);
        channelRef.current = null;
        subscribedRef.current = false;
      }

      // Create new channel for this table
      const channel = supabase
        .channel(`realtime_${tableName}_${user.id}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: tableName,
            filter: `user_id=eq.${user.id}`,
          },
          (payload) => {
            console.log(`🔄 INSERT on ${tableName}:`, payload);
            callbacks.onInsert?.(payload);
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: tableName,
            filter: `user_id=eq.${user.id}`,
          },
          (payload) => {
            console.log(`🔄 UPDATE on ${tableName}:`, payload);
            callbacks.onUpdate?.(payload);
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'DELETE',
            schema: 'public',
            table: tableName,
            filter: `user_id=eq.${user.id}`,
          },
          (payload) => {
            console.log(`🔄 DELETE on ${tableName}:`, payload);
            callbacks.onDelete?.(payload);
          }
        );

      // Subscribe with retry logic
      channel.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log(`✅ Realtime subscribed to ${tableName}`);
          channelRef.current = channel;
          subscribedRef.current = true;
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          console.warn(`⚠️ Subscription ${status} for ${tableName}`);
          subscribedRef.current = false;
          
          // Retry with exponential backoff (max 3 attempts)
          if (retryCount < 3) {
            const delay = Math.pow(2, retryCount) * 1000; // 1s, 2s, 4s
            console.log(`🔄 Retrying subscription for ${tableName} in ${delay}ms (attempt ${retryCount + 1}/3)`);
            setTimeout(() => {
              setupRealtime(retryCount + 1);
            }, delay);
          } else {
            console.error(`❌ Failed to subscribe to ${tableName} after 3 attempts`);
          }
        }
      });
    } catch (error) {
      console.error(`❌ Error setting up realtime for ${tableName}:`, error);
      
      // Retry on error
      if (retryCount < 3) {
        const delay = Math.pow(2, retryCount) * 1000;
        setTimeout(() => {
          setupRealtime(retryCount + 1);
        }, delay);
      }
    }
  }, [tableName, callbacks, enabled]);

  const cleanup = useCallback(async () => {
    if (channelRef.current) {
      console.log(`🧹 Cleaning up realtime subscription for ${tableName}`);
      await supabase.removeChannel(channelRef.current);
      channelRef.current = null;
      subscribedRef.current = false;
    }
  }, [tableName]);

  useEffect(() => {
    if (enabled) {
      setupRealtime();
    }
    
    return () => {
      cleanup();
    };
  }, [setupRealtime, cleanup, enabled]);

  return {
    setupRealtime,
    cleanup
  };
}