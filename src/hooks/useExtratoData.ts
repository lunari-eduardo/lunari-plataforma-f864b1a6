/**
 * Hook para carregamento e processamento de dados do extrato
 * MIGRADO PARA 100% SUPABASE
 */

import { useExtratoSupabase } from './useExtratoSupabase';

export function useExtratoData() {
  // ============= USAR HOOK SUPABASE =============
  const { linhasExtrato, isLoading } = useExtratoSupabase();

  // ============= DADOS JÁ VÊM DO SUPABASE =============
  // Não precisa mais carregar de localStorage ou processar manualmente

  return {
    linhasExtrato,
    isLoading,
    // Mantém compatibilidade com hooks que usam esses dados
    transacoesFinanceiras: [],
    pagamentosWorkflow: [],
    itensFinanceiros: [],
    cartoes: []
  };
}