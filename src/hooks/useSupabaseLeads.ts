import { useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import type { Lead } from '@/types/leads';
import {
  supabaseLeadToFrontend,
  frontendLeadToSupabase,
  frontendLeadUpdatesToSupabase,
} from '@/utils/leadTransformers';

const QUERY_KEY = 'leads';

export function useSupabaseLeads() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const userId = user?.id;

  // Fetch leads from Supabase
  const {
    data: leads = [],
    isLoading,
    refetch,
  } = useQuery({
    queryKey: [QUERY_KEY, userId],
    queryFn: async () => {
      if (!userId) return [];

      // Usar .or() para incluir leads onde arquivado é false OU null
      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .eq('user_id', userId)
        .or('arquivado.eq.false,arquivado.is.null')
        .order('created_at', { ascending: false });

      if (error) throw error;

      return (data || []).map(supabaseLeadToFrontend);
    },
    enabled: !!userId,
    staleTime: 1000 * 30, // 30 seconds
  });

  // Real-time subscription
  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel('leads-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'leads',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          console.log('🔄 [Leads] Mudança detectada:', payload.eventType);
          refetch();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, refetch]);

  // Add lead mutation
  const addLeadMutation = useMutation({
    mutationFn: async (input: Omit<Lead, 'id' | 'dataCriacao'>) => {
      if (!userId) throw new Error('Usuário não autenticado');

      console.log('🚀 [Leads] Criando lead no Supabase:', { nome: input.nome });

      const now = new Date().toISOString();
      const leadData = {
        ...input,
        statusTimestamp: now,
        historicoStatus: [{ status: input.status || 'novo_interessado', data: now }],
        interacoes: input.interacoes || [],
      };

      const insertData = frontendLeadToSupabase(leadData, userId);

      const { data, error } = await supabase
        .from('leads')
        .insert(insertData)
        .select()
        .single();

      if (error) throw error;

      console.log('✅ [Leads] Lead criado com sucesso:', data.id);
      return supabaseLeadToFrontend(data);
    },
    onSuccess: (newLead) => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY, userId] });
      toast({
        title: 'Lead criado',
        description: `Lead "${newLead.nome}" criado com sucesso`,
      });
    },
    onError: (error) => {
      console.error('❌ [Leads] Erro ao criar lead:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível criar o lead',
        variant: 'destructive',
      });
    },
  });

  // Update lead mutation with retry logic
  const updateLeadMutation = useMutation({
    mutationFn: async ({
      id,
      updates,
    }: {
      id: string;
      updates: Partial<Lead> | ((lead: Lead) => Lead);
    }) => {
      if (!userId) throw new Error('Usuário não autenticado');

      console.log('🔄 [Leads] Atualizando lead:', id);

      // Get current lead - para function updaters, buscar do banco para garantir estado fresco
      let finalUpdates: Partial<Lead>;
      if (typeof updates === 'function') {
        // Buscar lead fresco do banco para evitar race conditions
        const { data: freshLead, error: fetchError } = await supabase
          .from('leads')
          .select('*')
          .eq('id', id)
          .eq('user_id', userId)
          .single();

        if (fetchError || !freshLead) {
          console.error('❌ [Leads] Lead não encontrado no banco:', id);
          throw new Error('Lead não encontrado');
        }

        const currentLead = supabaseLeadToFrontend(freshLead);
        const updated = updates(currentLead);
        
        // Se o retorno é parcial (não tem 'id'), usar diretamente como partial update
        // Isso evita sobrescrever campos que não foram explicitamente retornados
        if (!('id' in updated) || !updated.id) {
          // Update parcial - apenas os campos retornados serão atualizados
          finalUpdates = updated;
        } else {
          // Update completo (spread do lead inteiro) - comportamento antigo
          finalUpdates = updated;
        }
      } else {
        finalUpdates = updates;
      }

      // Handle status change tracking (apenas se não veio do function updater que já inclui)
      if (finalUpdates.status && !finalUpdates.statusTimestamp) {
        const currentLead = leads.find((l) => l.id === id);
        if (currentLead && finalUpdates.status !== currentLead.status) {
          const now = new Date().toISOString();
          finalUpdates.statusTimestamp = now;
          
          // Só resetar needsFollowUp se não estiver sendo definido explicitamente
          if (finalUpdates.needsFollowUp === undefined) {
            finalUpdates.needsFollowUp = false;
          }

          // Só adicionar ao histórico se não vier do function updater
          if (!finalUpdates.historicoStatus) {
            const currentHistory = currentLead.historicoStatus || [];
            finalUpdates.historicoStatus = [
              ...currentHistory,
              { status: finalUpdates.status, data: now },
            ];
          }
        }
      }

      const dbUpdates = frontendLeadUpdatesToSupabase(finalUpdates);

      console.log('📝 [Leads] Enviando updates para Supabase:', Object.keys(dbUpdates));

      const { error } = await supabase
        .from('leads')
        .update(dbUpdates)
        .eq('id', id)
        .eq('user_id', userId);

      if (error) throw error;

      console.log('✅ [Leads] Lead atualizado com sucesso:', id);
    },
    retry: 2, // Tentar novamente até 2 vezes em caso de falha
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 3000),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY, userId] });
    },
    onError: (error, variables) => {
      console.error('❌ [Leads] Erro ao atualizar lead:', error, 'ID:', variables.id);
      toast({
        title: 'Erro ao mover lead',
        description: `Não foi possível atualizar o lead. Tente novamente.`,
        variant: 'destructive',
      });
    },
  });

  // Delete lead mutation
  const deleteLeadMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!userId) throw new Error('Usuário não autenticado');

      const { error } = await supabase
        .from('leads')
        .delete()
        .eq('id', id)
        .eq('user_id', userId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY, userId] });
      toast({
        title: 'Lead removido',
        description: 'Lead removido com sucesso',
      });
    },
    onError: (error) => {
      console.error('❌ [Leads] Erro ao deletar lead:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível remover o lead',
        variant: 'destructive',
      });
    },
  });

  // Wrapper functions with stable references
  const addLead = useCallback(
    async (input: Omit<Lead, 'id' | 'dataCriacao'>) => {
      return addLeadMutation.mutateAsync(input);
    },
    [addLeadMutation]
  );

  const updateLead = useCallback(
    (id: string, updates: Partial<Lead> | ((lead: Lead) => Lead)) => {
      updateLeadMutation.mutate({ id, updates });
    },
    [updateLeadMutation]
  );

  const deleteLead = useCallback(
    (id: string) => {
      deleteLeadMutation.mutate(id);
    },
    [deleteLeadMutation]
  );

  // Convert lead to client (creates or links to existing client)
  const convertToClient = useCallback(
    async (leadId: string) => {
      const lead = leads.find((l) => l.id === leadId);
      if (!lead) return null;

      // Check if already has clienteId
      if (lead.clienteId) {
        console.log('✅ [Leads] Lead já está vinculado a cliente:', lead.clienteId);
        return { id: lead.clienteId };
      }

      // Check for existing client with same email
      if (lead.email) {
        const { data: existingClients } = await supabase
          .from('clientes')
          .select('id, nome')
          .eq('user_id', userId!)
          .eq('email', lead.email)
          .limit(1);

        if (existingClients && existingClients.length > 0) {
          // Link to existing client
          await updateLeadMutation.mutateAsync({
            id: leadId,
            updates: { clienteId: existingClients[0].id },
          });
          console.log('✅ [Leads] Lead vinculado a cliente existente:', existingClients[0].id);
          return existingClients[0];
        }
      }

      // Create new client
      const { data: newClient, error } = await supabase
        .from('clientes')
        .insert({
          user_id: userId!,
          nome: lead.nome,
          email: lead.email || null,
          telefone: lead.telefone || null,
          whatsapp: lead.whatsapp || null,
          origem: lead.origem || 'Lead',
        })
        .select()
        .single();

      if (error) {
        console.error('❌ [Leads] Erro ao criar cliente:', error);
        toast({
          title: 'Erro',
          description: 'Não foi possível criar o cliente',
          variant: 'destructive',
        });
        return null;
      }

      // Link lead to new client
      await updateLeadMutation.mutateAsync({
        id: leadId,
        updates: { clienteId: newClient.id },
      });

      console.log('✅ [Leads] Novo cliente criado e vinculado:', newClient.id);
      toast({
        title: 'Cliente criado',
        description: `Cliente "${newClient.nome}" criado com sucesso`,
      });

      return newClient;
    },
    [leads, userId, updateLeadMutation]
  );

  return {
    leads,
    isLoading,
    addLead,
    updateLead,
    deleteLead,
    convertToClient,
    refetch,
  };
}
