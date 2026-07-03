import { useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { FollowUpConfig } from '@/types/leadInteractions';
import {
  supabaseConfigToFrontend,
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

      console.log('🔍 [FollowUpConfig] Buscando config para usuário:', userId);

      const { data, error } = await supabase
        .from('lead_follow_up_config')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) {
        console.error('❌ [FollowUpConfig] Erro ao buscar config:', error);
        throw error;
      }

      // If no config exists, create default
      if (!data) {
        console.log('📝 [FollowUpConfig] Config não encontrada, criando default...');
        
        const insertData = {
          user_id: userId,
          dias_para_follow_up: DEFAULT_FOLLOW_UP_CONFIG.diasParaFollowUp,
          ativo: DEFAULT_FOLLOW_UP_CONFIG.ativo,
          status_monitorado: DEFAULT_FOLLOW_UP_CONFIG.statusMonitorado,
        };
        
        console.log('📝 [FollowUpConfig] Inserindo:', insertData);
        
        const { data: inserted, error: insertError } = await supabase
          .from('lead_follow_up_config')
          .insert(insertData)
          .select()
          .single();

        if (insertError) {
          console.error('❌ [FollowUpConfig] Erro ao criar default:', insertError);
          return DEFAULT_FOLLOW_UP_CONFIG;
        }

        console.log('✅ [FollowUpConfig] Config criada:', inserted);
        return supabaseConfigToFrontend(inserted);
      }

      console.log('✅ [FollowUpConfig] Config encontrada:', data);
      return supabaseConfigToFrontend(data);
    },
    enabled: !!userId,
    staleTime: 1000 * 60 * 5, // 5 minutes
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
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

  // Update config mutation - usar UPSERT para garantir que a config existe
  const updateConfigMutation = useMutation({
    mutationFn: async (updates: Partial<FollowUpConfig>) => {
      if (!userId) throw new Error('Usuário não autenticado');

      console.log('🔄 [FollowUpConfig] Atualizando config:', updates);

      // Preparar dados com valores atuais + updates
      const upsertData = {
        user_id: userId,
        dias_para_follow_up: updates.diasParaFollowUp ?? config.diasParaFollowUp,
        ativo: updates.ativo ?? config.ativo,
        status_monitorado: updates.statusMonitorado ?? config.statusMonitorado,
        updated_at: new Date().toISOString(),
      };

      console.log('📝 [FollowUpConfig] Upsert data:', upsertData);

      // Usar upsert para criar ou atualizar
      const { error } = await supabase
        .from('lead_follow_up_config')
        .upsert(upsertData, {
          onConflict: 'user_id',
        });

      if (error) {
        console.error('❌ [FollowUpConfig] Erro ao atualizar:', error);
        throw error;
      }

      console.log('✅ [FollowUpConfig] Config atualizada com sucesso');
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
