import { useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import type { LeadStatusDef } from '@/types/leads';
import {
  supabaseStatusToFrontend,
  frontendStatusToSupabase,
  DEFAULT_LEAD_STATUSES,
} from '@/utils/leadTransformers';

const QUERY_KEY = 'lead-statuses';

export function useSupabaseLeadStatuses() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const userId = user?.id;

  // Fetch statuses from Supabase
  const {
    data: statuses = [],
    isLoading,
    refetch,
  } = useQuery({
    queryKey: [QUERY_KEY, userId],
    queryFn: async () => {
      if (!userId) return [];

      const { data, error } = await supabase
        .from('lead_statuses')
        .select('*')
        .eq('user_id', userId)
        .order('sort_order', { ascending: true });

      if (error) throw error;

      // If no statuses exist, create defaults
      if (!data || data.length === 0) {
        console.log('📝 [LeadStatuses] Criando statuses default para usuário');
        const defaultInserts = DEFAULT_LEAD_STATUSES.map((s) =>
          frontendStatusToSupabase(s, userId)
        );

        const { data: inserted, error: insertError } = await supabase
          .from('lead_statuses')
          .insert(defaultInserts)
          .select();

        if (insertError) {
          console.error('❌ [LeadStatuses] Erro ao criar defaults:', insertError);
          return DEFAULT_LEAD_STATUSES;
        }

        return (inserted || []).map(supabaseStatusToFrontend);
      }

      return data.map(supabaseStatusToFrontend);
    },
    enabled: !!userId,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  // Real-time subscription
  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel('lead-statuses-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'lead_statuses',
          filter: `user_id=eq.${userId}`,
        },
        () => {
          console.log('🔄 [LeadStatuses] Mudança detectada, atualizando...');
          refetch();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, refetch]);

  // Add status mutation
  const addStatusMutation = useMutation({
    mutationFn: async (name: string) => {
      if (!userId) throw new Error('Usuário não autenticado');

      const id = `lead_status_${Date.now()}`;
      const maxOrder = statuses.length > 0 ? Math.max(...statuses.map((s) => s.order)) : 0;

      const newStatus: LeadStatusDef = {
        id,
        key: id,
        name: name.trim() || 'Novo status',
        order: maxOrder + 1,
        color: '#6b7280',
      };

      const { data, error } = await supabase
        .from('lead_statuses')
        .insert(frontendStatusToSupabase(newStatus, userId))
        .select()
        .single();

      if (error) throw error;
      return supabaseStatusToFrontend(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY, userId] });
    },
    onError: (error) => {
      console.error('❌ [LeadStatuses] Erro ao adicionar status:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível adicionar o status',
        variant: 'destructive',
      });
    },
  });

  // Update status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<LeadStatusDef> }) => {
      if (!userId) throw new Error('Usuário não autenticado');

      const updates: Record<string, unknown> = {};
      if (patch.name !== undefined) updates.name = patch.name;
      if (patch.key !== undefined) updates.key = patch.key;
      if (patch.order !== undefined) updates.sort_order = patch.order;
      if (patch.color !== undefined) updates.color = patch.color;
      if (patch.isConverted !== undefined) updates.is_converted = patch.isConverted;
      if (patch.isLost !== undefined) updates.is_lost = patch.isLost;

      const { error } = await supabase
        .from('lead_statuses')
        .update(updates)
        .eq('id', id)
        .eq('user_id', userId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY, userId] });
    },
    onError: (error) => {
      console.error('❌ [LeadStatuses] Erro ao atualizar status:', error);
    },
  });

  // Remove status mutation
  const removeStatusMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!userId) throw new Error('Usuário não autenticado');

      const { error } = await supabase
        .from('lead_statuses')
        .delete()
        .eq('id', id)
        .eq('user_id', userId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY, userId] });
    },
    onError: (error) => {
      console.error('❌ [LeadStatuses] Erro ao remover status:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível remover o status',
        variant: 'destructive',
      });
    },
  });

  // Move status (swap order with adjacent)
  const moveStatus = useCallback(
    async (id: string, direction: 'up' | 'down') => {
      const idx = statuses.findIndex((s) => s.id === id);
      if (idx === -1) return;

      const swapWith = direction === 'up' ? idx - 1 : idx + 1;
      if (swapWith < 0 || swapWith >= statuses.length) return;

      const current = statuses[idx];
      const other = statuses[swapWith];

      // Swap orders
      await Promise.all([
        updateStatusMutation.mutateAsync({ id: current.id, patch: { order: other.order } }),
        updateStatusMutation.mutateAsync({ id: other.id, patch: { order: current.order } }),
      ]);
    },
    [statuses, updateStatusMutation]
  );

  const getConvertedKey = useCallback(() => {
    return statuses.find((s) => s.isConverted)?.key || 'fechado';
  }, [statuses]);

  const getDefaultOpenKey = useCallback(() => {
    return statuses.find((s) => !s.isConverted && !s.isLost)?.key || statuses[0]?.key || 'novo_interessado';
  }, [statuses]);

  return {
    statuses,
    isLoading,
    addStatus: (name: string) => addStatusMutation.mutateAsync(name),
    updateStatus: (id: string, patch: Partial<LeadStatusDef>) =>
      updateStatusMutation.mutateAsync({ id, patch }),
    removeStatus: (id: string) => removeStatusMutation.mutateAsync(id),
    moveStatus,
    getConvertedKey,
    getDefaultOpenKey,
  };
}
