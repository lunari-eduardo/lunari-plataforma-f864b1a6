/**
 * Hook otimizado para extrato 100% Supabase
 * Substitui localStorage por queries diretas ao banco
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { LinhaExtrato, ExtratoTipo, ExtratoStatus } from '@/types/extrato';

export function useExtratoSupabase() {
  const queryClient = useQueryClient();

  // ============= QUERY UNIFICADA DO EXTRATO =============
  const { data: linhasExtrato = [], isLoading } = useQuery({
    queryKey: ['extrato-unificado'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('extrato_unificado')
        .select('*')
        .order('data', { ascending: false });
      
      if (error) {
        console.error('❌ Erro ao carregar extrato:', error);
        throw error;
      }

      // Mapear para LinhaExtrato
      return (data || []).map((row: any): LinhaExtrato => ({
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
    linhasExtrato,
    isLoading
  };
}
