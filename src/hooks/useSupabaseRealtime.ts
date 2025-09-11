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

  const setupRealtime = useCallback(async () => {
    if (!enabled) return;

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
      }

      // Create new channel for this table
      const channel = supabase
        .channel(`realtime_${tableName}`)
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

      // Subscribe to the channel
      channel.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log(`✅ Realtime subscribed to ${tableName}`);
          channelRef.current = channel;
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          console.error(`❌ Failed to subscribe to ${tableName}:`, status);
        }
      });
    } catch (error) {
      console.error(`❌ Error setting up realtime for ${tableName}:`, error);
    }
  }, [tableName, callbacks, enabled]);

  const cleanup = useCallback(async () => {
    if (channelRef.current) {
      console.log(`🧹 Cleaning up realtime subscription for ${tableName}`);
      await supabase.removeChannel(channelRef.current);
      channelRef.current = null;
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