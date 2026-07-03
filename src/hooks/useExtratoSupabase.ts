/**
 * Hook otimizado para extrato 100% Supabase
 * Com paginação server-side, filtros de período e regime contábil (caixa | competência)
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { LinhaExtrato, ExtratoTipo, ExtratoStatus, ExtratoOrigem } from '@/types/extrato';

export type RegimeContabil = 'caixa' | 'competencia';

// Função para mapear dados do Supabase para LinhaExtrato
function mapLinhasExtrato(data: any[], regime: RegimeContabil): LinhaExtrato[] {
  return data.map((row: any): LinhaExtrato => {
    // Data exibida = depende do regime selecionado
    const dataExibida = regime === 'competencia' 
      ? (row.data_competencia || row.data) 
      : row.data;

    return {
      id: `${row.tipo}_${row.id}`,
      data: dataExibida,
      tipo: row.tipo as ExtratoTipo,
      descricao: row.descricao || 'Sem descrição',
      origem: row.origem,
      cliente: row.cliente || undefined,
      projeto: row.projeto || undefined,
      categoria: row.categoria || row.categoria_session || undefined,
      parcela: (row.parcela_atual && row.parcela_total) ? {
        atual: row.parcela_atual,
        total: row.parcela_total
      } : null,
      valor: Number(row.valor) || 0,
      status: row.status as ExtratoStatus,
      observacoes: row.observacoes || undefined,
      cartao: row.cartao || undefined,
      meioPagamento: row.meio_pagamento || undefined,
      referenciaId: row.id,
      referenciaOrigem: row.origem,
      // Datas auxiliares para indicação visual na tabela
      dataCaixa: row.data,
      dataCompetencia: row.data_competencia || row.data,
    } as LinhaExtrato;
  });
}

interface UseExtratoSupabaseParams {
  dataInicio?: string;
  dataFim?: string;
  page?: number;
  pageSize?: number;
  regime?: RegimeContabil;
  tipo?: ExtratoTipo | 'todos';
  origem?: ExtratoOrigem | 'todos';
  status?: ExtratoStatus | 'todos';
}

export function useExtratoSupabase({
  dataInicio,
  dataFim,
  page = 1,
  pageSize = 50,
  regime = 'caixa',
  tipo,
  origem,
  status
}: UseExtratoSupabaseParams = {}) {
  const queryClient = useQueryClient();

  // Coluna de filtro/ordem depende do regime
  const dataColumn = regime === 'competencia' ? 'data_competencia' : 'data';

  // ============= QUERY PAGINADA COM FILTROS SERVER-SIDE =============
  const { data: resultado, isLoading } = useQuery({
    queryKey: ['extrato-unificado', regime, dataInicio, dataFim, page, pageSize, tipo, origem, status],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      let query = supabase
        .from('extrato_unificado')
        .select('*', { count: 'estimated' })
        .eq('user_id', user.id)
        .order(dataColumn, { ascending: false })
        .order('created_at', { ascending: false });

      if (dataInicio) {
        query = query.gte(dataColumn, dataInicio);
      }
      if (dataFim) {
        query = query.lte(dataColumn, dataFim);
      }
      if (tipo && tipo !== 'todos') {
        query = query.eq('tipo', tipo);
      }
      if (origem && origem !== 'todos') {
        query = query.eq('origem', origem);
      }
      if (status && status !== 'todos') {
        query = query.eq('status', status);
      }

      query = query.range(from, to);

      const { data, count, error } = await query;

      if (error) {
        console.error('❌ Erro ao carregar extrato:', error);
        throw error;
      }

      return {
        linhas: mapLinhasExtrato(data || [], regime),
        totalCount: count || 0,
        totalPages: Math.ceil((count || 0) / pageSize)
      };
    },
    staleTime: 2 * 60_000, // 2 min — realtime invalida em mutação
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
  });

  // ============= REALTIME SUBSCRIPTIONS COM DEBOUNCE =============
  const invalidationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  const debouncedInvalidate = useCallback(() => {
    if (invalidationTimeoutRef.current) {
      clearTimeout(invalidationTimeoutRef.current);
    }
    invalidationTimeoutRef.current = setTimeout(() => {
      queryClient.invalidateQueries({ queryKey: ['extrato-unificado'] });
      invalidationTimeoutRef.current = null;
    }, 150);
  }, [queryClient]);
  
  useEffect(() => {
    let userId: string | null = null;
    let channel: any = null;
    
    const setupChannel = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      userId = user?.id || null;
      
      if (!userId) return;

      channel = supabase
        .channel(`extrato-changes-${userId}`)
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'clientes_transacoes',
          filter: `user_id=eq.${userId}`
        }, () => debouncedInvalidate())
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'fin_transactions',
          filter: `user_id=eq.${userId}`
        }, () => debouncedInvalidate())
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'clientes_sessoes',
          filter: `user_id=eq.${userId}`
        }, () => debouncedInvalidate())
        .subscribe();
    };
    
    setupChannel();

    return () => {
      if (invalidationTimeoutRef.current) {
        clearTimeout(invalidationTimeoutRef.current);
      }
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [queryClient, debouncedInvalidate]);

  return {
    linhasExtrato: resultado?.linhas || [],
    totalCount: resultado?.totalCount || 0,
    totalPages: resultado?.totalPages || 0,
    page,
    pageSize,
    isLoading
  };
}
