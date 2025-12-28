import { useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { FollowUpConfig } from '@/types/leadInteractions';
import {
  supabaseConfigToFrontend,
  frontendConfigToSupabase,
  DEFAULT_FOLLOW_UP_CONFIG,
} from '@/utils/leadTransformers';

const QUERY_KEY = 'follow-up-config';

export function useSupabaseFollowUpConfig() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const userId = user?.id;

  // Fetch config from Supabase
  const {
    data: config = DEFAULT_FOLLOW_UP_CONFIG,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: [QUERY_KEY, userId],
    queryFn: async () => {
      if (!userId) return DEFAULT_FOLLOW_UP_CONFIG;

      const { data, error } = await supabase
        .from('lead_follow_up_config')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) throw error;

      // If no config exists, create default
      if (!data) {
        console.log('📝 [FollowUpConfig] Criando config default para usuário');
        const { data: inserted, error: insertError } = await supabase
          .from('lead_follow_up_config')
          .insert(frontendConfigToSupabase(DEFAULT_FOLLOW_UP_CONFIG, userId))
          .select()
          .single();

        if (insertError) {
          console.error('❌ [FollowUpConfig] Erro ao criar default:', insertError);
          return DEFAULT_FOLLOW_UP_CONFIG;
        }

        return supabaseConfigToFrontend(inserted);
      }

      return supabaseConfigToFrontend(data);
    },
    enabled: !!userId,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  // Real-time subscription
  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel('follow-up-config-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'lead_follow_up_config',
          filter: `user_id=eq.${userId}`,
        },
        () => {
          console.log('🔄 [FollowUpConfig] Mudança detectada, atualizando...');
          refetch();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, refetch]);

  // Update config mutation
  const updateConfigMutation = useMutation({
    mutationFn: async (updates: Partial<FollowUpConfig>) => {
      if (!userId) throw new Error('Usuário não autenticado');

      const dbUpdates: Record<string, unknown> = {};
      if (updates.diasParaFollowUp !== undefined) dbUpdates.dias_para_follow_up = updates.diasParaFollowUp;
      if (updates.ativo !== undefined) dbUpdates.ativo = updates.ativo;
      if (updates.statusMonitorado !== undefined) dbUpdates.status_monitorado = updates.statusMonitorado;

      const { error } = await supabase
        .from('lead_follow_up_config')
        .update(dbUpdates)
        .eq('user_id', userId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY, userId] });
    },
    onError: (error) => {
      console.error('❌ [FollowUpConfig] Erro ao atualizar config:', error);
    },
  });

  const updateConfig = useCallback(
    (updates: Partial<FollowUpConfig>) => {
      return updateConfigMutation.mutateAsync(updates);
    },
    [updateConfigMutation]
  );

  return {
    config,
    isLoading,
    updateConfig,
  };
}
