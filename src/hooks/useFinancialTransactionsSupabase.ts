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
// Onda 5b.2 — Facade: este hook agora é uma fachada que delega para as
// capabilities canônicas do módulo `finance` (`finance.transaction.*`).
// Mantém a superfície pública intacta para os consumidores legados.
import { useRunCapability, CapabilityError } from '@/shared/capability/react';
import {
  createTransaction,
  updateTransaction,
  deleteTransaction,
  markTransactionPaid,
  markTransactionPending,
} from '@/modules/finance';

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
  const run = () => {
    (async () => {
      try {
        const { data, error } = await (supabase as any).rpc('fin_promote_overdue_to_faturado');
        if (error) return; // silencioso — cron diário cobre
        if (typeof data === 'number' && data > 0) {
          queryClient.invalidateQueries({ queryKey: ['financial-transactions'] });
        }
      } catch {
        // ignore
      }
    })();
  };
  const idle = (window as any).requestIdleCallback as undefined | ((cb: () => void) => number);
  if (idle) idle(run);
  else setTimeout(run, 0);
}

async function checkIfEquipmentAndNotify(
  itemId: string,
  allIds: string[],
  variables: CreateTransactionParams | CreateTransactionInput
) {
  try {
    const { data: item } = await supabase
      .from('fin_items_master')
      .select('nome, grupo_principal')
      .eq('id', itemId)
      .maybeSingle();

    if (item?.nome === 'Equipamentos' && item?.grupo_principal === 'Investimento') {
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

/**
 * Normaliza payload legado para o input da capability `finance.transaction.create`.
 * Resolve `modo` a partir das flags (`credit_card_id`, `isParcelado`, `isRecorrente`).
 */
function toCreateCapabilityInput(
  params: CreateTransactionParams | CreateTransactionInput,
): Parameters<typeof createTransaction.execute>[0] {
  const normalized: CreateTransactionParams =
    'item_id' in params
      ? params
      : {
          item_id: params.itemId,
          valor: params.valorTotal,
          data_vencimento: params.dataPrimeiraOcorrencia,
          data_competencia: params.dataCompetencia,
          observacoes: params.observacoes,
          isRecorrente: params.isRecorrente,
          isValorFixo: params.isValorFixo,
          isParcelado: params.isParcelado,
          parcela_total: params.numeroDeParcelas,
          credit_card_id: params.cartaoCreditoId,
          data_compra: params.dataCompra || params.dataPrimeiraOcorrencia,
        };

  let modo: 'unico' | 'parcelado' | 'recorrente' | 'cartao' = 'unico';
  if (normalized.credit_card_id) modo = 'cartao';
  else if (normalized.isParcelado && (normalized.parcela_total ?? 0) > 1) modo = 'parcelado';
  else if (normalized.isRecorrente) modo = 'recorrente';

  return {
    itemId: normalized.item_id,
    valor: normalized.valor,
    dataVencimento: normalized.data_vencimento,
    dataCompetencia: modo === 'unico' ? normalized.data_competencia : undefined,
    observacoes: normalized.observacoes,
    modo,
    parcelaTotal: modo === 'parcelado' || modo === 'cartao' ? normalized.parcela_total : undefined,
    cartaoId: modo === 'cartao' ? normalized.credit_card_id : undefined,
    dataCompra: modo === 'cartao' ? normalized.data_compra ?? normalized.data_vencimento : undefined,
    isValorFixo: modo === 'recorrente' ? (normalized.isValorFixo ?? true) : undefined,
    source: 'user',
  } as any;
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

  // ============= MUTATIONS (Onda 5b.2 — via capabilities) =============

  const runCapability = useRunCapability();

  function invalidateAll() {
    queryClient.invalidateQueries({ queryKey: ['financial-transactions'] });
    queryClient.invalidateQueries({ queryKey: ['extrato-unificado'] });
  }

  function unwrapOrThrow<T>(
    result: Awaited<ReturnType<typeof runCapability>>,
  ): T {
    if (result.ok) return result.value as T;
    throw new CapabilityError(result.error);
  }

  const criarTransacaoMutation = useMutation({
    mutationFn: async (params: CreateTransactionParams | CreateTransactionInput) => {
      const input = toCreateCapabilityInput(params);
      const res = await runCapability(createTransaction, input);
      return unwrapOrThrow<{ ids: string[]; count: number }>(res);
    },
    onSuccess: async (result, variables) => {
      invalidateAll();
      const itemId = 'item_id' in variables ? variables.item_id : (variables as any).itemId;
      await checkIfEquipmentAndNotify(itemId, result.ids, variables);
    },
    onError: (error) => {
      console.error('Erro ao criar transação:', error);
      toast({ title: 'Erro', description: 'Erro ao criar transação', variant: 'destructive' });
    },
  });

  const atualizarTransacaoMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<NovaTransacaoFinanceira> }) => {
      // Rotear mudanças de status para capabilities dedicadas.
      if (updates.status) {
        if (updates.status === 'Pago') {
          const res = await runCapability(markTransactionPaid, { id, source: 'user' } as any);
          unwrapOrThrow(res);
        } else if (updates.status === 'Faturado') {
          const res = await runCapability(markTransactionPending, { id, source: 'user' } as any);
          unwrapOrThrow(res);
        } else {
          // 'Agendado' não tem capability dedicada — limitação documentada.
          console.warn('[finance] update.status="Agendado" não suportado via capability; ignorado.');
        }
      }
      const { status: _ignored, ...rest } = updates;
      const hasFieldUpdates =
        rest.valor !== undefined ||
        rest.data_vencimento !== undefined ||
        rest.observacoes !== undefined;
      if (hasFieldUpdates) {
        const res = await runCapability(updateTransaction, {
          id,
          valor: rest.valor,
          dataVencimento: rest.data_vencimento,
          observacoes: rest.observacoes ?? null,
          source: 'user',
        } as any);
        unwrapOrThrow(res);
      }
      return { id };
    },
    onSuccess: () => invalidateAll(),
    onError: (error) => {
      console.error('Erro ao atualizar transação:', error);
      toast({ title: 'Erro', description: 'Erro ao atualizar transação', variant: 'destructive' });
    },
  });

  const removerTransacaoMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await runCapability(deleteTransaction, { id, source: 'user' } as any);
      unwrapOrThrow(res);
      return { id };
    },
    onSuccess: () => invalidateAll(),
    onError: (error) => {
      console.error('Erro ao remover transação:', error);
      toast({ title: 'Erro', description: 'Erro ao remover transação', variant: 'destructive' });
    },
  });

  const marcarComoPagoMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await runCapability(markTransactionPaid, { id, source: 'user' } as any);
      unwrapOrThrow(res);
      return { id };
    },
    onSuccess: () => invalidateAll(),
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
