/**
 * Hook para carregamento e processamento de dados do extrato
 * MIGRADO PARA 100% SUPABASE COM PAGINAÇÃO + REGIME (caixa | competência)
 */

import { useExtratoSupabase, RegimeContabil } from './useExtratoSupabase';
import { ExtratoTipo, ExtratoOrigem, ExtratoStatus } from '@/types/extrato';

interface UseExtratoDataParams {
  dataInicio?: string;
  dataFim?: string;
  page?: number;
  pageSize?: number;
  regime?: RegimeContabil;
  tipo?: ExtratoTipo | 'todos';
  origem?: ExtratoOrigem | 'todos';
  status?: ExtratoStatus | 'todos';
}

export function useExtratoData({
  dataInicio,
  dataFim,
  page,
  pageSize,
  regime,
  tipo,
  origem,
  status
}: UseExtratoDataParams = {}) {
  const { 
    linhasExtrato, 
    totalCount, 
    totalPages, 
    isLoading 
  } = useExtratoSupabase({ dataInicio, dataFim, page, pageSize, regime, tipo, origem, status });

  return {
    linhasExtrato,
    totalCount,
    totalPages,
    isLoading,
    transacoesFinanceiras: [],
    pagamentosWorkflow: [],
    itensFinanceiros: [],
    cartoes: []
  };
}
