/**
 * Hook otimizado para extrato 100% Supabase
 * Com paginação server-side e filtros de período
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { LinhaExtrato, ExtratoTipo, ExtratoStatus } from '@/types/extrato';

// Função para mapear dados do Supabase para LinhaExtrato
function mapLinhasExtrato(data: any[]): LinhaExtrato[] {
  return data.map((row: any): LinhaExtrato => ({
    id: `${row.tipo}_${row.id}`,
    data: row.data,
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
    referenciaId: row.id,
    referenciaOrigem: row.origem
  }));
}

interface UseExtratoSupabaseParams {
  dataInicio?: string;
  dataFim?: string;
  page?: number;
  pageSize?: number;
}

export function useExtratoSupabase({
  dataInicio,
  dataFim,
  page = 1,
  pageSize = 50
}: UseExtratoSupabaseParams = {}) {
  const queryClient = useQueryClient();

  // ============= QUERY PAGINADA COM FILTROS SERVER-SIDE =============
  const { data: resultado, isLoading } = useQuery({
    queryKey: ['extrato-unificado', dataInicio, dataFim, page, pageSize],
    queryFn: async () => {
      // Calcular offset para paginação
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      // Construir query base com contagem
      let query = supabase
        .from('extrato_unificado')
        .select('*', { count: 'exact' })
        .order('data', { ascending: false });

      // Aplicar filtros de período no servidor
      if (dataInicio) {
        query = query.gte('data', dataInicio);
      }
      if (dataFim) {
        query = query.lte('data', dataFim);
      }

      // Aplicar paginação
      query = query.range(from, to);

      const { data, count, error } = await query;

      if (error) {
        console.error('❌ Erro ao carregar extrato:', error);
        throw error;
      }

      return {
        linhas: mapLinhasExtrato(data || []),
        totalCount: count || 0,
        totalPages: Math.ceil((count || 0) / pageSize)
      };
    },
    staleTime: 30000, // Cache por 30 segundos
  });

  // ============= REALTIME SUBSCRIPTIONS =============
  useEffect(() => {
    console.log('📡 Configurando realtime para extrato...');
    
    const channel = supabase
      .channel('extrato-changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'clientes_transacoes',
        filter: 'tipo=eq.pagamento'
      }, (payload) => {
        console.log('💰 Pagamento alterado:', payload);
        // Invalidar queries do extrato
        queryClient.invalidateQueries({ queryKey: ['extrato-unificado'] });
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'fin_transactions'
      }, (payload) => {
        console.log('💸 Despesa alterada:', payload);
        queryClient.invalidateQueries({ queryKey: ['extrato-unificado'] });
      })
      .subscribe();

    return () => {
      console.log('🔌 Removendo canal de realtime');
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return {
    linhasExtrato: resultado?.linhas || [],
    totalCount: resultado?.totalCount || 0,
    totalPages: resultado?.totalPages || 0,
    page,
    pageSize,
    isLoading
  };
}
