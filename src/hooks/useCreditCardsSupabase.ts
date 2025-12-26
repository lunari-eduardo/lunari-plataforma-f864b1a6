/**
 * Hook para gerenciar cartões de crédito com Supabase
 * Substitui localStorage por persistência no banco
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { SupabaseCreditCardsAdapter, CreditCardDB } from '@/adapters/SupabaseCreditCardsAdapter';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

export interface CartaoCredito {
  id: string;
  nome: string;
  diaVencimento: number;
  diaFechamento: number;
  ativo: boolean;
}

export function useCreditCardsSupabase() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // ============= BUSCAR CARTÕES =============
  const { data: cartoes = [], isLoading } = useQuery({
    queryKey: ['credit-cards'],
    queryFn: async () => {
      try {
        const cards = await SupabaseCreditCardsAdapter.getAllCards();
        return cards.map(card => ({
          id: card.id,
          nome: card.nome,
          diaVencimento: card.dia_vencimento,
          diaFechamento: card.dia_fechamento,
          ativo: card.ativo
        }));
      } catch (error) {
        console.error('Erro ao buscar cartões:', error);
        throw error;
      }
    },
    staleTime: 60000, // 1 minuto
  });

  // ============= REALTIME SUBSCRIPTION (COM DEBOUNCE) =============
  useEffect(() => {
    let debounceTimer: ReturnType<typeof setTimeout>;
    
    const channel = supabase
      .channel('credit-cards-changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'fin_credit_cards'
      }, () => {
        // Debounce de 500ms para evitar múltiplas invalidações em cascata
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          queryClient.invalidateQueries({ queryKey: ['credit-cards'] });
        }, 500);
      })
      .subscribe();

    return () => {
      clearTimeout(debounceTimer);
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  // ============= CRIAR CARTÃO =============
  const criarCartaoMutation = useMutation({
    mutationFn: async (dados: { nome: string; diaVencimento: number; diaFechamento: number }) => {
      return await SupabaseCreditCardsAdapter.createCard(
        dados.nome,
        dados.diaVencimento,
        dados.diaFechamento
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['credit-cards'] });
      toast({
        title: "Cartão adicionado",
        description: "Cartão de crédito cadastrado com sucesso",
      });
    },
    onError: (error) => {
      console.error('Erro ao criar cartão:', error);
      toast({
        title: "Erro ao adicionar cartão",
        description: "Não foi possível cadastrar o cartão de crédito",
        variant: "destructive",
      });
    }
  });

  // ============= ATUALIZAR CARTÃO =============
  const atualizarCartaoMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<CartaoCredito> }) => {
      const dbUpdates: Partial<CreditCardDB> = {};
      
      if (updates.nome !== undefined) dbUpdates.nome = updates.nome;
      if (updates.diaVencimento !== undefined) dbUpdates.dia_vencimento = updates.diaVencimento;
      if (updates.diaFechamento !== undefined) dbUpdates.dia_fechamento = updates.diaFechamento;
      if (updates.ativo !== undefined) dbUpdates.ativo = updates.ativo;
      
      return await SupabaseCreditCardsAdapter.updateCard(id, dbUpdates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['credit-cards'] });
      toast({
        title: "Cartão atualizado",
        description: "Informações do cartão atualizadas com sucesso",
      });
    },
    onError: (error) => {
      console.error('Erro ao atualizar cartão:', error);
      toast({
        title: "Erro ao atualizar cartão",
        description: "Não foi possível atualizar o cartão de crédito",
        variant: "destructive",
      });
    }
  });

  // ============= REMOVER CARTÃO (SOFT DELETE) =============
  const removerCartaoMutation = useMutation({
    mutationFn: async (id: string) => {
      return await SupabaseCreditCardsAdapter.deleteCard(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['credit-cards'] });
      toast({
        title: "Cartão removido",
        description: "Cartão de crédito desativado com sucesso",
      });
    },
    onError: (error) => {
      console.error('Erro ao remover cartão:', error);
      toast({
        title: "Erro ao remover cartão",
        description: "Não foi possível remover o cartão de crédito",
        variant: "destructive",
      });
    }
  });

  return {
    cartoes,
    isLoading,
    adicionarCartao: (dados: { nome: string; diaVencimento: number; diaFechamento: number }) => 
      criarCartaoMutation.mutate(dados),
    atualizarCartao: (id: string, updates: Partial<CartaoCredito>) => 
      atualizarCartaoMutation.mutate({ id, updates }),
    removerCartao: (id: string) => 
      removerCartaoMutation.mutate(id),
    isCreating: criarCartaoMutation.isPending,
    isUpdating: atualizarCartaoMutation.isPending,
    isDeleting: removerCartaoMutation.isPending,
  };
}
