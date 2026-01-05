/**
 * FASE 3: Hook Unificado para Transações Financeiras - 100% SUPABASE
 * 
 * Centraliza toda a lógica de transações financeiras:
 * - Queries otimizadas por mês/ano
 * - Motor unificado de criação (detecta tipo automaticamente)
 * - Realtime updates via Supabase subscriptions
 * - Integração com Extrato e Demonstrativo
 * - Integração com detecção de equipamentos para precificação
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useMemo, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { SupabaseFinancialTransactionsAdapter } from '@/adapters/SupabaseFinancialTransactionsAdapter';
import { SupabaseFinancialItemsAdapter } from '@/adapters/SupabaseFinancialItemsAdapter';
import { NovaTransacaoFinanceira, GrupoPrincipal, StatusTransacao } from '@/types/financas';
import { useToast } from '@/hooks/use-toast';
import { emitEquipmentCandidate, EQUIPMENT_FORCE_SCAN_EVENT } from '@/hooks/useEquipmentSync';
import { roundToTwoDecimals } from '@/utils/financialPrecision';

// Adapters - usar métodos estáticos

// Tipos para criação de transações
export interface CreateTransactionParams {
  item_id: string;
  valor: number;
  data_vencimento: string;
  observacoes?: string;
  isRecorrente?: boolean;
  isValorFixo?: boolean;
  isParcelado?: boolean;
  parcela_total?: number;
  credit_card_id?: string;
  data_compra?: string;
}

// Interface de compatibilidade com sistema antigo
export interface CreateTransactionInput {
  itemId: string;
  valorTotal: number;
  dataPrimeiraOcorrencia: string;
  isRecorrente?: boolean;
  isParcelado?: boolean;
  numeroDeParcelas?: number;
  observacoes?: string;
  isValorFixo?: boolean;
  cartaoCreditoId?: string;
  dataCompra?: string;
}

// Tipo estendido com informações do item
export interface TransacaoComItem extends NovaTransacaoFinanceira {
  dataVencimento: string;
  parent_id?: string;
  parcela_atual?: number;
  parcela_total?: number;
  item: {
    id: string;
    nome: string;
    grupo_principal: GrupoPrincipal;
  };
}

/**
 * Hook principal para gerenciamento de transações financeiras
 */
// Função auxiliar para verificar se transação é de Equipamento e emitir notificação
async function checkIfEquipmentAndNotify(
  itemId: string, 
  result: any, 
  variables: CreateTransactionParams | CreateTransactionInput
) {
  try {
    const { data: item } = await supabase
      .from('fin_items_master')
      .select('nome, grupo_principal')
      .eq('id', itemId)
      .maybeSingle();
    
    if (item?.nome === 'Equipamentos' && item?.grupo_principal === 'Investimento') {
      console.log('🔧 [FinancialTransactions] Transação de equipamento detectada!');
      
      // Extrair TODOS os IDs quando for parcelado
      const allIds: string[] = Array.isArray(result) 
        ? result.map((r: any) => r.id).filter(Boolean) 
        : [result?.id].filter(Boolean);

      const transactionId = allIds[0]; // ID principal (primeira parcela)
      
      // Usar valor TOTAL, não da parcela
      const valorTotal = 'valor' in variables ? variables.valor : (variables as any).valorTotal;
      const observacoes = variables.observacoes;
      
      // A data deve ser da primeira ocorrência
      const dataCompra = 'data_compra' in variables ? variables.data_compra : 
                         'data_vencimento' in variables ? variables.data_vencimento :
                         (variables as any).dataPrimeiraOcorrencia;

      // Limpar sufixo de parcela do nome se houver (ex: "Câmera (1/2)" -> "Câmera")
      const nomeLimpo = observacoes?.replace(/\s*\(\d+\/\d+\)$/, '').trim();
      
      if (transactionId) {
        // Emitir candidato com valor TOTAL e TODOS os IDs
        emitEquipmentCandidate({
          transacaoId: transactionId,
          nome: nomeLimpo || `Novo Equipamento R$ ${valorTotal.toFixed(2)}`,
          valor: valorTotal,
          data: dataCompra || new Date().toISOString().split('T')[0],
          observacoes: nomeLimpo,
          allTransactionIds: allIds
        });
      } else {
        // Fallback: disparar force-scan
        window.dispatchEvent(new CustomEvent(EQUIPMENT_FORCE_SCAN_EVENT));
      }
    }
  } catch (error) {
    console.error('🔧 [FinancialTransactions] Erro ao verificar equipamento:', error);
  }
}

export function useFinancialTransactionsSupabase(filtroMesAno: { mes: number; ano: number }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // ============= QUERY: TRANSAÇÕES DO MÊS =============
  const { data: transacoes = [], isLoading } = useQuery({
    queryKey: ['financial-transactions', filtroMesAno.ano, filtroMesAno.mes],
    queryFn: async () => {
      // IMPORTANTE: Atualizar status de transações vencidas ANTES de buscar
      try {
        await SupabaseFinancialTransactionsAdapter.updateStatusByDate();
      } catch (error) {
        console.error('Erro ao atualizar status por data:', error);
      }

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
          dataVencimento: t.data_vencimento,
          status: t.status as StatusTransacao,
          observacoes: t.observacoes || undefined,
          parcela_atual: t.parcela_atual ?? undefined,
          parcela_total: t.parcela_total ?? undefined,
          parent_id: t.parent_id ?? undefined,
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

  // ============= REALTIME SUBSCRIPTIONS COM DEBOUNCE =============
  // Ref para controlar debounce de invalidações
  const invalidationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  // Função debounced para invalidar cache (evita múltiplas invalidações)
  const debouncedInvalidate = useCallback(() => {
    if (invalidationTimeoutRef.current) {
      clearTimeout(invalidationTimeoutRef.current);
    }
    invalidationTimeoutRef.current = setTimeout(() => {
      queryClient.invalidateQueries({ queryKey: ['financial-transactions'] });
      invalidationTimeoutRef.current = null;
    }, 150); // 150ms debounce
  }, [queryClient]);

  useEffect(() => {
    // Obter user_id para filtrar apenas eventos do usuário atual
    let userId: string | null = null;
    
    const setupChannel = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      userId = user?.id || null;
      
      if (!userId) {
        console.warn('⚠️ [FinTransactions] Sem user_id para filtrar real-time');
        return;
      }

      const channel = supabase
        .channel(`fin-transactions-${userId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'fin_transactions',
            filter: `user_id=eq.${userId}` // ✅ FILTRAR POR USER_ID
          },
          () => {
            // Usar debounce para evitar múltiplas invalidações
            debouncedInvalidate();
          }
        )
        .subscribe();

      return channel;
    };

    let channel: any = null;
    setupChannel().then(ch => { channel = ch; });

    return () => {
      if (invalidationTimeoutRef.current) {
        clearTimeout(invalidationTimeoutRef.current);
      }
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [queryClient, debouncedInvalidate]);

  // ============= VERIFICAÇÃO PERIÓDICA DE STATUS VENCIDO =============
  const lastPeriodicCheck = useRef<number>(Date.now());
  
  useEffect(() => {
    // Verificar a cada 5 minutos se há transações que venceram
    const intervalId = setInterval(async () => {
      try {
        const updated = await SupabaseFinancialTransactionsAdapter.updateStatusByDate();
        if (updated > 0) {
          queryClient.invalidateQueries({ queryKey: ['financial-transactions'] });
          toast({
            title: 'Transações atualizadas',
            description: `${updated} transação(ões) atualizada(s) para "Faturado".`,
          });
        }
        lastPeriodicCheck.current = Date.now();
      } catch (error) {
        console.error('Erro na verificação periódica:', error);
      }
    }, 5 * 60 * 1000); // 5 minutos

    return () => clearInterval(intervalId);
  }, [queryClient, toast]);

  // ============= MUTATION: CRIAR TRANSAÇÃO =============
  const criarTransacaoMutation = useMutation({
    mutationFn: async (params: CreateTransactionParams | CreateTransactionInput) => {
      // Normalizar parâmetros para formato interno
      const normalizedParams: CreateTransactionParams = 'item_id' in params ? params as CreateTransactionParams : {
        item_id: (params as CreateTransactionInput).itemId,
        valor: (params as CreateTransactionInput).valorTotal,
        data_vencimento: (params as CreateTransactionInput).dataPrimeiraOcorrencia,
        observacoes: params.observacoes,
        isRecorrente: (params as CreateTransactionInput).isRecorrente,
        isValorFixo: params.isValorFixo,
        isParcelado: (params as CreateTransactionInput).isParcelado,
        parcela_total: (params as CreateTransactionInput).numeroDeParcelas,
        credit_card_id: (params as CreateTransactionInput).cartaoCreditoId,
        data_compra: (params as CreateTransactionInput).dataCompra || (params as CreateTransactionInput).dataPrimeiraOcorrencia
      };

      const {
        item_id,
        valor,
        data_vencimento,
        observacoes,
        isRecorrente,
        isValorFixo,
        isParcelado,
        parcela_total,
        credit_card_id,
        data_compra
      } = normalizedParams;

      // PRIORIDADE 1: Cartão de Crédito
      if (credit_card_id) {
        return await SupabaseFinancialTransactionsAdapter.createCreditCardTransactions({
          itemId: item_id,
          valorTotal: valor,
          dataCompra: data_compra || data_vencimento,
          cartaoCreditoId: credit_card_id,
          numeroDeParcelas: parcela_total || 1,
          observacoes
        });
      }

      // PRIORIDADE 2: Parcelado
      if (isParcelado && parcela_total && parcela_total > 1) {
        return await SupabaseFinancialTransactionsAdapter.createParceledTransactions({
          itemId: item_id,
          valorTotal: valor,
          dataPrimeiraOcorrencia: data_vencimento,
          numeroDeParcelas: parcela_total,
          observacoes
        });
      }

      // PRIORIDADE 3: Recorrente Anual (12 meses)
      if (isRecorrente) {
        const [ano, mes, dia] = data_vencimento.split('-').map(Number);
        return await SupabaseFinancialTransactionsAdapter.createRecurringYearlyTransactions({
          itemId: item_id,
          valor,
          diaVencimento: dia,
          dataInicio: data_vencimento,
          isValorFixo: isValorFixo ?? true,
          observacoes
        });
      }

      // PADRÃO: Transação Única
      return await SupabaseFinancialTransactionsAdapter.createTransaction({
        item_id,
        valor,
        data_vencimento,
        status: data_vencimento <= new Date().toISOString().split('T')[0] ? 'Faturado' : 'Agendado',
        observacoes: observacoes || null
      });
    },
    onSuccess: async (result, variables) => {
      queryClient.invalidateQueries({ queryKey: ['financial-transactions'] });
      queryClient.invalidateQueries({ queryKey: ['extrato-unificado'] });
      
      // Verificar se é transação de Equipamento e emitir evento
      const itemId = 'item_id' in variables ? variables.item_id : (variables as any).itemId;
      await checkIfEquipmentAndNotify(itemId, result, variables);
      
      // Toast removido - feedback visual ocorre pela atualização da tabela
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
      // Toast removido - feedback visual ocorre pela atualização da tabela
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
      // Toast removido - feedback visual ocorre pela atualização da tabela
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
      // Toast removido - feedback visual ocorre pela atualização da tabela
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
    
    // Aplicar arredondamento para evitar erros de precisão de ponto flutuante
    const total = roundToTwoDecimals(transacoesGrupo.reduce((sum, t) => sum + t.valor, 0));
    const pago = roundToTwoDecimals(transacoesGrupo.filter(t => t.status === 'Pago').reduce((sum, t) => sum + t.valor, 0));
    const faturado = roundToTwoDecimals(transacoesGrupo.filter(t => t.status === 'Faturado').reduce((sum, t) => sum + t.valor, 0));
    const agendado = roundToTwoDecimals(transacoesGrupo.filter(t => t.status === 'Agendado').reduce((sum, t) => sum + t.valor, 0));

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
