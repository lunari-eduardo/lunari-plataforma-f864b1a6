/**
 * FASE 3: Hook Unificado para Transações Financeiras - 100% SUPABASE
 * 
 * Centraliza toda a lógica de transações financeiras:
 * - Queries otimizadas por mês/ano
 * - Motor unificado de criação (detecta tipo automaticamente)
 * - Realtime updates via Supabase subscriptions
 * - Integração com Extrato e Demonstrativo
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { SupabaseFinancialTransactionsAdapter } from '@/adapters/SupabaseFinancialTransactionsAdapter';
import { SupabaseFinancialItemsAdapter } from '@/adapters/SupabaseFinancialItemsAdapter';
import { NovaTransacaoFinanceira, GrupoPrincipal, StatusTransacao } from '@/types/financas';
import { useToast } from '@/hooks/use-toast';

// Adapters - usar métodos estáticos

// Tipos para criação de transações
export interface CreateTransactionParams {
  itemId: string;
  valorTotal: number;
  dataPrimeiraOcorrencia: string;
  isRecorrente: boolean;
  isParcelado: boolean;
  numeroDeParcelas?: number;
  observacoes?: string;
  isValorFixo?: boolean;
  cartaoCreditoId?: string;
}

// Tipo estendido com informações do item
export interface TransacaoComItem extends NovaTransacaoFinanceira {
  item: {
    id: string;
    nome: string;
    grupo_principal: GrupoPrincipal;
  };
}

/**
 * Hook principal para gerenciamento de transações financeiras
 */
export function useFinancialTransactionsSupabase(filtroMesAno: { mes: number; ano: number }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // ============= QUERY: TRANSAÇÕES DO MÊS =============
  const { data: transacoes = [], isLoading } = useQuery({
    queryKey: ['financial-transactions', filtroMesAno.ano, filtroMesAno.mes],
    queryFn: async () => {
      // Calcular range de datas do mês
      const startDate = `${filtroMesAno.ano}-${filtroMesAno.mes.toString().padStart(2, '0')}-01`;
      const ultimoDiaMes = new Date(filtroMesAno.ano, filtroMesAno.mes, 0).getDate();
      const endDate = `${filtroMesAno.ano}-${filtroMesAno.mes.toString().padStart(2, '0')}-${ultimoDiaMes}`;

      const transacoesDb = await SupabaseFinancialTransactionsAdapter.getTransactionsByDateRange(startDate, endDate);
      
      // Buscar itens para juntar com transações
      const itens = await SupabaseFinancialItemsAdapter.getAllItems();
      const itensMap = new Map(itens.map(item => [item.id, item]));

      // Mapear para formato com item
      return transacoesDb.map(t => {
        const item = itensMap.get(t.item_id);
        return {
          id: t.id,
          item_id: t.item_id,
          valor: t.valor,
          data_vencimento: t.data_vencimento,
          status: t.status as StatusTransacao,
          observacoes: t.observacoes || undefined,
          parcelas: t.parcela_atual && t.parcela_total 
            ? { atual: t.parcela_atual, total: t.parcela_total }
            : undefined,
          userId: t.user_id,
          criadoEm: t.created_at,
          item: item ? {
            id: item.id,
            nome: item.nome,
            grupo_principal: item.grupo_principal
          } : {
            id: t.item_id,
            nome: 'Item Removido',
            grupo_principal: 'Despesa Variável' as GrupoPrincipal
          }
        } as TransacaoComItem;
      });
    },
    staleTime: 30000, // Cache por 30 segundos
  });

  // ============= REALTIME SUBSCRIPTIONS =============
  useEffect(() => {
    const channel = supabase
      .channel('financial-transactions-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'fin_transactions'
        },
        () => {
          // Invalidar query quando houver mudanças
          queryClient.invalidateQueries({ queryKey: ['financial-transactions'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  // ============= MUTATION: CRIAR TRANSAÇÃO =============
  const criarTransacaoMutation = useMutation({
    mutationFn: async (params: CreateTransactionParams) => {
      const {
        itemId,
        valorTotal,
        dataPrimeiraOcorrencia,
        isRecorrente,
        isParcelado,
        numeroDeParcelas,
        observacoes,
        isValorFixo,
        cartaoCreditoId
      } = params;

      // PRIORIDADE 1: Cartão de Crédito
      if (cartaoCreditoId) {
        return await SupabaseFinancialTransactionsAdapter.createCreditCardTransactions({
          itemId,
          valorTotal,
          dataCompra: dataPrimeiraOcorrencia,
          cartaoCreditoId,
          numeroDeParcelas,
          observacoes
        });
      }

      // PRIORIDADE 2: Parcelado
      if (isParcelado && numeroDeParcelas && numeroDeParcelas > 1) {
        return await SupabaseFinancialTransactionsAdapter.createParceledTransactions({
          itemId,
          valorTotal,
          dataPrimeiraOcorrencia,
          numeroDeParcelas,
          observacoes
        });
      }

      // PRIORIDADE 3: Recorrente Anual (12 meses)
      if (isRecorrente) {
        const [ano, mes, dia] = dataPrimeiraOcorrencia.split('-').map(Number);
        return await SupabaseFinancialTransactionsAdapter.createRecurringYearlyTransactions({
          itemId,
          valor: valorTotal,
          diaVencimento: dia,
          dataInicio: dataPrimeiraOcorrencia,
          isValorFixo: isValorFixo ?? true,
          observacoes
        });
      }

      // PADRÃO: Transação Única
      return await SupabaseFinancialTransactionsAdapter.createTransaction({
        item_id: itemId,
        valor: valorTotal,
        data_vencimento: dataPrimeiraOcorrencia,
        status: dataPrimeiraOcorrencia <= new Date().toISOString().split('T')[0] ? 'Faturado' : 'Agendado',
        observacoes: observacoes || null,
        parcela_atual: null,
        parcela_total: null,
        recurring_blueprint_id: null,
        credit_card_id: null,
        data_compra: null,
        parent_id: null
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['financial-transactions'] });
      queryClient.invalidateQueries({ queryKey: ['extrato-unificado'] });
      toast({
        title: "Sucesso",
        description: "Transação criada com sucesso"
      });
    },
    onError: (error) => {
      console.error('Erro ao criar transação:', error);
      toast({
        title: "Erro",
        description: "Erro ao criar transação",
        variant: "destructive"
      });
    }
  });

  // ============= MUTATION: ATUALIZAR TRANSAÇÃO =============
  const atualizarTransacaoMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<NovaTransacaoFinanceira> }) => {
      return await SupabaseFinancialTransactionsAdapter.updateTransaction(id, {
        valor: updates.valor,
        data_vencimento: updates.data_vencimento,
        status: updates.status,
        observacoes: updates.observacoes || null
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['financial-transactions'] });
      queryClient.invalidateQueries({ queryKey: ['extrato-unificado'] });
      toast({
        title: "Sucesso",
        description: "Transação atualizada"
      });
    },
    onError: (error) => {
      console.error('Erro ao atualizar transação:', error);
      toast({
        title: "Erro",
        description: "Erro ao atualizar transação",
        variant: "destructive"
      });
    }
  });

  // ============= MUTATION: REMOVER TRANSAÇÃO =============
  const removerTransacaoMutation = useMutation({
    mutationFn: async (id: string) => {
      return await SupabaseFinancialTransactionsAdapter.deleteTransaction(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['financial-transactions'] });
      queryClient.invalidateQueries({ queryKey: ['extrato-unificado'] });
      toast({
        title: "Sucesso",
        description: "Transação removida"
      });
    },
    onError: (error) => {
      console.error('Erro ao remover transação:', error);
      toast({
        title: "Erro",
        description: "Erro ao remover transação",
        variant: "destructive"
      });
    }
  });

  // ============= MUTATION: MARCAR COMO PAGO =============
  const marcarComoPagoMutation = useMutation({
    mutationFn: async (id: string) => {
      return await SupabaseFinancialTransactionsAdapter.markAsPaid(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['financial-transactions'] });
      queryClient.invalidateQueries({ queryKey: ['extrato-unificado'] });
      toast({
        title: "Sucesso",
        description: "Transação marcada como paga"
      });
    },
    onError: (error) => {
      console.error('Erro ao marcar como pago:', error);
      toast({
        title: "Erro",
        description: "Erro ao marcar como pago",
        variant: "destructive"
      });
    }
  });

  // ============= AGRUPAR POR GRUPO PRINCIPAL =============
  const transacoesPorGrupo = transacoes.reduce((acc, transacao) => {
    const grupo = transacao.item.grupo_principal;
    if (!acc[grupo]) acc[grupo] = [];
    acc[grupo].push(transacao);
    return acc;
  }, {} as Record<GrupoPrincipal, TransacaoComItem[]>);

  // Garantir que todos os grupos existam
  const gruposCompletos: Record<GrupoPrincipal, TransacaoComItem[]> = {
    'Despesa Fixa': transacoesPorGrupo['Despesa Fixa'] || [],
    'Despesa Variável': transacoesPorGrupo['Despesa Variável'] || [],
    'Investimento': transacoesPorGrupo['Investimento'] || [],
    'Receita Não Operacional': transacoesPorGrupo['Receita Não Operacional'] || [],
    'Receita Operacional': transacoesPorGrupo['Receita Operacional'] || []
  };

  // ============= CALCULAR MÉTRICAS POR GRUPO =============
  const calcularMetricasPorGrupo = (grupo: GrupoPrincipal) => {
    const transacoesGrupo = gruposCompletos[grupo] || [];
    
    const total = transacoesGrupo.reduce((sum, t) => sum + t.valor, 0);
    const pago = transacoesGrupo.filter(t => t.status === 'Pago').reduce((sum, t) => sum + t.valor, 0);
    const faturado = transacoesGrupo.filter(t => t.status === 'Faturado').reduce((sum, t) => sum + t.valor, 0);
    const agendado = transacoesGrupo.filter(t => t.status === 'Agendado').reduce((sum, t) => sum + t.valor, 0);

    return { total, pago, faturado, agendado };
  };

  return {
    // Dados
    transacoes,
    transacoesPorGrupo: gruposCompletos,
    isLoading,

    // Funções de mutação
    criarTransacao: criarTransacaoMutation.mutate,
    atualizarTransacao: (id: string, updates: Partial<NovaTransacaoFinanceira>) => 
      atualizarTransacaoMutation.mutate({ id, updates }),
    removerTransacao: removerTransacaoMutation.mutate,
    marcarComoPago: marcarComoPagoMutation.mutate,

    // Cálculos
    calcularMetricasPorGrupo
  };
}
