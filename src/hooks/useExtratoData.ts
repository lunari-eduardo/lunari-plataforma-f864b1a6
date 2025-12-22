/**
 * Hook para carregamento e processamento de dados do extrato
 * MIGRADO PARA 100% SUPABASE COM PAGINAÇÃO
 */

import { useExtratoSupabase } from './useExtratoSupabase';

interface UseExtratoDataParams {
  dataInicio?: string;
  dataFim?: string;
  page?: number;
  pageSize?: number;
}

export function useExtratoData({
  dataInicio,
  dataFim,
  page,
  pageSize
}: UseExtratoDataParams = {}) {
  // ============= USAR HOOK SUPABASE COM PAGINAÇÃO =============
  const { 
    linhasExtrato, 
    totalCount, 
    totalPages, 
    isLoading 
  } = useExtratoSupabase({ dataInicio, dataFim, page, pageSize });

  return {
    linhasExtrato,
    totalCount,
    totalPages,
    isLoading,
    // Mantém compatibilidade com hooks que usam esses dados
    transacoesFinanceiras: [],
    pagamentosWorkflow: [],
    itensFinanceiros: [],
    cartoes: []
  };
}
