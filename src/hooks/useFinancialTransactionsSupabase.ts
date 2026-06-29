/**
 * Hook unificado de transações financeiras.
 *
 * Otimizações (jun/2026):
 *  - `updateStatusByDate` saiu do `queryFn`. Promoção Agendado→Faturado roda
 *    agora via cron Postgres (`fin_promote_overdue_to_faturado`). Backstop
 *    fire-and-forget 1× por sessão, após o primeiro paint, fora do caminho crítico.
 *  - Realtime local removido — a única fonte é o `FinanceRealtimeBridge`
 *    (canal `finance_v2:<userId>`), que invalida as queries debounced.
 *  - Itens consultados em query própria (`fin-items-master`, cache infinito).
 *  - `initialData` puxa do `transactionsStore`/`itemsStore` hidratados pela
 *    bridge → primeiro paint sem cold fetch quando dados já estão no cliente.
 */

import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { SupabaseFinancialTransactionsAdapter } from '@/adapters/SupabaseFinancialTransactionsAdapter';
import { SupabaseFinancialItemsAdapter } from '@/adapters/SupabaseFinancialItemsAdapter';
import { NovaTransacaoFinanceira, GrupoPrincipal, StatusTransacao } from '@/types/financas';
import { useToast } from '@/hooks/use-toast';
import { emitEquipmentCandidate, EQUIPMENT_FORCE_SCAN_EVENT } from '@/hooks/useEquipmentSync';
import { roundToTwoDecimals } from '@/utils/financialPrecision';
import { transactionsStore } from '@/modules/finance/presentation/store/transactionsStore';
import { itemsStore } from '@/modules/finance/presentation/store/itemsStore';

export interface CreateTransactionParams {
  item_id: string;
  valor: number;
  data_vencimento: string;
  data_competencia?: string;
  observacoes?: string;
  isRecorrente?: boolean;
  isValorFixo?: boolean;
  isParcelado?: boolean;
  parcela_total?: number;
  credit_card_id?: string;
  data_compra?: string;
}

export interface CreateTransactionInput {
  itemId: string;
  valorTotal: number;
  dataPrimeiraOcorrencia: string;
  dataCompetencia?: string;
  isRecorrente?: boolean;
  isParcelado?: boolean;
  numeroDeParcelas?: number;
  observacoes?: string;
  isValorFixo?: boolean;
  cartaoCreditoId?: string;
  dataCompra?: string;
}

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

// --------- helpers internos ---------

function monthRange(ano: number, mes: number) {
  const startDate = `${ano}-${mes.toString().padStart(2, '0')}-01`;
  const ultimoDia = new Date(ano, mes, 0).getDate();
  const endDate = `${ano}-${mes.toString().padStart(2, '0')}-${ultimoDia.toString().padStart(2, '0')}`;
  return { startDate, endDate };
}

// Backstop client-side, fora da rota crítica. 1× por sessão.
let __promoteFired = false;
function fireAndForgetPromoteOverdue(queryClient: ReturnType<typeof useQueryClient>) {
  if (__promoteFired) return;
  __promoteFired = true;
  const run = () =>
    supabase
      .rpc('fin_promote_overdue_to_faturado')
      .then(({ data, error }) => {
        if (error) {
          // silencioso — cron diário cobre
          return;
        }
        if (typeof data === 'number' && data > 0) {
          queryClient.invalidateQueries({ queryKey: ['financial-transactions'] });
        }
      })
      .catch(() => void 0);
  const idle = (window as any).requestIdleCallback as undefined | ((cb: () => void) => number);
  if (idle) idle(run);
  else setTimeout(run, 0);
}

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
      const allIds: string[] = Array.isArray(result)
        ? result.map((r: any) => r.id).filter(Boolean)
        : [result?.id].filter(Boolean);
      const transactionId = allIds[0];
      const valorTotal = 'valor' in variables ? variables.valor : (variables as any).valorTotal;
      const observacoes = variables.observacoes;
      const dataCompra =
        'data_compra' in variables
          ? variables.data_compra
          : 'data_vencimento' in variables
          ? variables.data_vencimento
          : (variables as any).dataPrimeiraOcorrencia;
      const nomeLimpo = observacoes?.replace(/\s*\(\d+\/\d+\)$/, '').trim();
      if (transactionId) {
        emitEquipmentCandidate({
          transacaoId: transactionId,
          nome: nomeLimpo || `Novo Equipamento R$ ${valorTotal.toFixed(2)}`,
          valor: valorTotal,
          data: dataCompra || new Date().toISOString().split('T')[0],
          observacoes: nomeLimpo,
          allTransactionIds: allIds,
        });
      } else {
        window.dispatchEvent(new CustomEvent(EQUIPMENT_FORCE_SCAN_EVENT));
      }
    }
  } catch (error) {
    console.error('🔧 [FinancialTransactions] Erro ao verificar equipamento:', error);
  }
}

// --------- hook ---------

export function useFinancialTransactionsSupabase(filtroMesAno: { mes: number; ano: number }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Itens em query própria, cache até evento Realtime.
  const { data: itensAtivos = [] } = useQuery({
    queryKey: ['fin-items-master'],
    queryFn: async () => SupabaseFinancialItemsAdapter.getAllItems(),
    staleTime: Infinity,
    gcTime: 30 * 60 * 1000,
    initialData: () => {
      const fromStore = itemsStore.getAll();
      if (fromStore.length === 0) return undefined;
      // converte para o shape que o adapter retorna
      return fromStore.map((i) => ({
        id: i.id,
        nome: i.nome,
        grupo_principal: i.grupo as GrupoPrincipal,
        userId: i.userId,
        ativo: i.ativo,
        criadoEm: i.criadoEm,
        user_id: i.userId,
        is_default: false,
      })) as any;
    },
  });

  const itensAtivosMap = useMemo(() => {
    const m = new Map<string, { id: string; nome: string; grupo_principal: GrupoPrincipal }>();
    for (const it of itensAtivos) m.set(it.id, it as any);
    return m;
  }, [itensAtivos]);

  const { data: transacoes = [], isLoading } = useQuery({
    queryKey: ['financial-transactions', filtroMesAno.ano, filtroMesAno.mes],
    queryFn: async () => {
      const { startDate, endDate } = monthRange(filtroMesAno.ano, filtroMesAno.mes);
      const rows = await SupabaseFinancialTransactionsAdapter.getTransactionsByDateRange(startDate, endDate);
      return rows.map((t) => {
        const item = itensAtivosMap.get(t.item_id);
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
          item: item
            ? { id: item.id, nome: item.nome, grupo_principal: item.grupo_principal }
            : { id: t.item_id, nome: 'Item Removido', grupo_principal: 'Despesa Variável' as GrupoPrincipal },
        } as TransacaoComItem;
      });
    },
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    placeholderData: keepPreviousData,
    // initialData a partir do store hidratado pela FinanceRealtimeBridge
    initialData: () => {
      const fromStore = transactionsStore.getByMonth(filtroMesAno.ano, filtroMesAno.mes);
      if (fromStore.length === 0) return undefined;
      return fromStore.map((t) => {
        const item = itensAtivosMap.get(t.itemId);
        return {
          id: t.id,
          item_id: t.itemId,
          valor: t.valor,
          data_vencimento: t.dataVencimento,
          dataVencimento: t.dataVencimento,
          status: t.status as StatusTransacao,
          observacoes: t.observacoes || undefined,
          parcela_atual: t.parcelaAtual ?? undefined,
          parcela_total: t.parcelaTotal ?? undefined,
          parent_id: undefined,
          userId: t.userId,
          criadoEm: t.criadoEm,
          item: item
            ? { id: item.id, nome: item.nome, grupo_principal: item.grupo_principal }
            : { id: t.itemId, nome: 'Item Removido', grupo_principal: 'Despesa Variável' as GrupoPrincipal },
        } as TransacaoComItem;
      });
    },
    initialDataUpdatedAt: () => (transactionsStore.getVersion() > 0 ? Date.now() - 1 : 0),
  });

  // Backstop client-side fora da rota crítica (cron cobre, isso é segurança extra).
  useEffect(() => {
    if (isLoading) return;
    fireAndForgetPromoteOverdue(queryClient);
  }, [isLoading, queryClient]);

  // ============= MUTATIONS =============

  const criarTransacaoMutation = useMutation({
    mutationFn: async (params: CreateTransactionParams | CreateTransactionInput) => {
      const normalizedParams: CreateTransactionParams =
        'item_id' in params
          ? (params as CreateTransactionParams)
          : {
              item_id: (params as CreateTransactionInput).itemId,
              valor: (params as CreateTransactionInput).valorTotal,
              data_vencimento: (params as CreateTransactionInput).dataPrimeiraOcorrencia,
              data_competencia: (params as CreateTransactionInput).dataCompetencia,
              observacoes: params.observacoes,
              isRecorrente: (params as CreateTransactionInput).isRecorrente,
              isValorFixo: params.isValorFixo,
              isParcelado: (params as CreateTransactionInput).isParcelado,
              parcela_total: (params as CreateTransactionInput).numeroDeParcelas,
              credit_card_id: (params as CreateTransactionInput).cartaoCreditoId,
              data_compra:
                (params as CreateTransactionInput).dataCompra ||
                (params as CreateTransactionInput).dataPrimeiraOcorrencia,
            };

      const {
        item_id,
        valor,
        data_vencimento,
        data_competencia,
        observacoes,
        isRecorrente,
        isValorFixo,
        isParcelado,
        parcela_total,
        credit_card_id,
        data_compra,
      } = normalizedParams;

      if (credit_card_id) {
        return await SupabaseFinancialTransactionsAdapter.createCreditCardTransactions({
          itemId: item_id,
          valorTotal: valor,
          dataCompra: data_compra || data_vencimento,
          cartaoCreditoId: credit_card_id,
          numeroDeParcelas: parcela_total || 1,
          observacoes,
        });
      }
      if (isParcelado && parcela_total && parcela_total > 1) {
        return await SupabaseFinancialTransactionsAdapter.createParceledTransactions({
          itemId: item_id,
          valorTotal: valor,
          dataPrimeiraOcorrencia: data_vencimento,
          numeroDeParcelas: parcela_total,
          observacoes,
        });
      }
      if (isRecorrente) {
        const [, , dia] = data_vencimento.split('-').map(Number);
        return await SupabaseFinancialTransactionsAdapter.createRecurringYearlyTransactions({
          itemId: item_id,
          valor,
          diaVencimento: dia,
          dataInicio: data_vencimento,
          isValorFixo: isValorFixo ?? true,
          observacoes,
        });
      }
      return await SupabaseFinancialTransactionsAdapter.createTransaction({
        item_id,
        valor,
        data_vencimento,
        data_competencia: data_competencia || null,
        status: data_vencimento <= new Date().toISOString().split('T')[0] ? 'Faturado' : 'Agendado',
        observacoes: observacoes || null,
      } as any);
    },
    onSuccess: async (result, variables) => {
      queryClient.invalidateQueries({ queryKey: ['financial-transactions'] });
      queryClient.invalidateQueries({ queryKey: ['extrato-unificado'] });
      const itemId = 'item_id' in variables ? variables.item_id : (variables as any).itemId;
      await checkIfEquipmentAndNotify(itemId, result, variables);
    },
    onError: (error) => {
      console.error('Erro ao criar transação:', error);
      toast({ title: 'Erro', description: 'Erro ao criar transação', variant: 'destructive' });
    },
  });

  const atualizarTransacaoMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<NovaTransacaoFinanceira> }) => {
      return await SupabaseFinancialTransactionsAdapter.updateTransaction(id, {
        valor: updates.valor,
        data_vencimento: updates.data_vencimento,
        status: updates.status,
        observacoes: updates.observacoes || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['financial-transactions'] });
      queryClient.invalidateQueries({ queryKey: ['extrato-unificado'] });
    },
    onError: (error) => {
      console.error('Erro ao atualizar transação:', error);
      toast({ title: 'Erro', description: 'Erro ao atualizar transação', variant: 'destructive' });
    },
  });

  const removerTransacaoMutation = useMutation({
    mutationFn: async (id: string) => SupabaseFinancialTransactionsAdapter.deleteTransaction(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['financial-transactions'] });
      queryClient.invalidateQueries({ queryKey: ['extrato-unificado'] });
    },
    onError: (error) => {
      console.error('Erro ao remover transação:', error);
      toast({ title: 'Erro', description: 'Erro ao remover transação', variant: 'destructive' });
    },
  });

  const marcarComoPagoMutation = useMutation({
    mutationFn: async (id: string) => SupabaseFinancialTransactionsAdapter.markAsPaid(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['financial-transactions'] });
      queryClient.invalidateQueries({ queryKey: ['extrato-unificado'] });
    },
    onError: (error) => {
      console.error('Erro ao marcar como pago:', error);
      toast({ title: 'Erro', description: 'Erro ao marcar como pago', variant: 'destructive' });
    },
  });

  // ============= AGRUPAMENTO + MÉTRICAS =============

  const transacoesPorGrupoRaw = transacoes.reduce((acc, t) => {
    const grupo = t.item.grupo_principal;
    if (!acc[grupo]) acc[grupo] = [];
    acc[grupo].push(t);
    return acc;
  }, {} as Record<GrupoPrincipal, TransacaoComItem[]>);

  const gruposCompletos: Record<GrupoPrincipal, TransacaoComItem[]> = {
    'Despesa Fixa': transacoesPorGrupoRaw['Despesa Fixa'] || [],
    'Despesa Variável': transacoesPorGrupoRaw['Despesa Variável'] || [],
    Investimento: transacoesPorGrupoRaw['Investimento'] || [],
    'Receita Não Operacional': transacoesPorGrupoRaw['Receita Não Operacional'] || [],
    'Receita Operacional': transacoesPorGrupoRaw['Receita Operacional'] || [],
  };

  const calcularMetricasPorGrupo = useCallback(
    (grupo: GrupoPrincipal) => {
      const lista = gruposCompletos[grupo] || [];
      const total = roundToTwoDecimals(lista.reduce((s, t) => s + t.valor, 0));
      const pago = roundToTwoDecimals(lista.filter((t) => t.status === 'Pago').reduce((s, t) => s + t.valor, 0));
      const faturado = roundToTwoDecimals(lista.filter((t) => t.status === 'Faturado').reduce((s, t) => s + t.valor, 0));
      const agendado = roundToTwoDecimals(lista.filter((t) => t.status === 'Agendado').reduce((s, t) => s + t.valor, 0));
      return { total, pago, faturado, agendado };
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [transacoes],
  );

  return {
    transacoes,
    transacoesPorGrupo: gruposCompletos,
    isLoading,
    criarTransacao: criarTransacaoMutation.mutate,
    atualizarTransacao: (id: string, updates: Partial<NovaTransacaoFinanceira>) =>
      atualizarTransacaoMutation.mutate({ id, updates }),
    removerTransacao: removerTransacaoMutation.mutate,
    marcarComoPago: marcarComoPagoMutation.mutate,
    calcularMetricasPorGrupo,
  };
}
