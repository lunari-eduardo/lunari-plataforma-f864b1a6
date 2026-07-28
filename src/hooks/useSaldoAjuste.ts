/**
 * Ajuste contábil de saldo — cria automaticamente uma transação
 * (Receita Não Operacional ou Despesa Variável) para bater com o
 * saldo real em conta na data escolhida.
 *
 * Também expõe `useSaldoAte(data)` para prévia em tempo real.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentUserId } from '@/hooks/useCurrentUserId';

export function useSaldoAte(dataISO: string | undefined) {
  const userId = useCurrentUserId();
  return useQuery<number>({
    queryKey: ['finance', 'saldo-ate', userId, dataISO],
    enabled: !!userId && !!dataISO,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('finance_get_saldo_ate' as any, { _data: dataISO });
      if (error) throw error;
      return Number(data ?? 0);
    },
  });
}

interface AjusteInput {
  data: string; // YYYY-MM-DD
  saldoDesejado: number;
  observacoes?: string;
}

interface AjusteResult {
  acao: 'noop' | 'entrada' | 'saida';
  valor_delta: number;
  transaction_id: string | null;
}

export function useAplicarSaldoAjuste() {
  const qc = useQueryClient();
  return useMutation<AjusteResult, Error, AjusteInput>({
    mutationFn: async ({ data, saldoDesejado, observacoes }) => {
      const { data: row, error } = await supabase.rpc('finance_apply_saldo_ajuste' as any, {
        _data: data,
        _saldo_desejado: saldoDesejado,
        _observacoes: observacoes ?? null,
      });
      if (error) throw error;
      const first = Array.isArray(row) ? row[0] : row;
      return {
        acao: (first?.acao ?? 'noop') as AjusteResult['acao'],
        valor_delta: Number(first?.valor_delta ?? 0),
        transaction_id: first?.transaction_id ?? null,
      };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['finance', 'opening-balance'] });
      qc.invalidateQueries({ queryKey: ['finance', 'saldo-ate'] });
      qc.invalidateQueries({ queryKey: ['dashboard-transactions-period'] });
      qc.invalidateQueries({ queryKey: ['dashboard-financeiro'] });
      qc.invalidateQueries({ queryKey: ['extrato-unificado'] });
      qc.invalidateQueries({ queryKey: ['fin_transactions'] });
    },
  });
}
