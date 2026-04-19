/**
 * Hook para carregamento e processamento de dados do extrato
 * MIGRADO PARA 100% SUPABASE COM PAGINAÇÃO + REGIME (caixa | competência)
 */

import { useExtratoSupabase, RegimeContabil } from './useExtratoSupabase';

interface UseExtratoDataParams {
  dataInicio?: string;
  dataFim?: string;
  page?: number;
  pageSize?: number;
  regime?: RegimeContabil;
}

export function useExtratoData({
  dataInicio,
  dataFim,
  page,
  pageSize,
  regime
}: UseExtratoDataParams = {}) {
  const { 
    linhasExtrato, 
    totalCount, 
    totalPages, 
    isLoading 
  } = useExtratoSupabase({ dataInicio, dataFim, page, pageSize, regime });

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
