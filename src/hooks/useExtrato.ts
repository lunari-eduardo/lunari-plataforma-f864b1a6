/**
 * Hook principal do extrato - refatorado para usar hooks especializados
 * TODO: [SUPABASE] Este hook será simplificado quando migrarmos para queries Supabase
 */

import { useCallback } from 'react';
import { LinhaExtrato } from '@/types/extrato';
import { useExtratoData } from '@/hooks/useExtratoData';
import { useExtratoFilters } from '@/hooks/useExtratoFilters';
import { useExtratoCalculations } from '@/hooks/useExtratoCalculations';

export function useExtrato() {
  // ============= HOOKS ESPECIALIZADOS =============
  const extratoData = useExtratoData();
  const filters = useExtratoFilters(extratoData.linhasExtrato);
  const calculations = useExtratoCalculations(
    filters.linhasFiltradas, 
    filters.filtros,
    {
      transacoesFinanceiras: extratoData.transacoesFinanceiras,
      pagamentosWorkflow: extratoData.pagamentosWorkflow,
      itensFinanceiros: extratoData.itensFinanceiros
    }
  );

  // ============= DRILL-DOWN =============
  const abrirOrigem = useCallback((linha: LinhaExtrato) => {
    // TODO: [SUPABASE] Implementar drill-down para modais específicos
    // TODO: [SUPABASE] Criar queries para buscar detalhes da origem
    console.log('Abrir origem:', linha);
  }, []);

  // ============= EXPORTAÇÃO =============
  const prepararDadosExportacao = useCallback(() => {
    return {
      periodo: {
        inicio: filters.filtros.dataInicio,
        fim: filters.filtros.dataFim
      },
      resumo: calculations.resumo,
      linhas: calculations.linhasComSaldo,
      filtrosAplicados: filters.filtros
    };
  }, [filters.filtros, calculations.resumo, calculations.linhasComSaldo]);

  return {
    // Dados principais
    linhas: calculations.linhasComSaldo,
    resumo: calculations.resumo,
    demonstrativo: calculations.demonstrativo,
    
    // Estados de filtros
    filtros: filters.filtros,
    preferencias: filters.preferencias,
    
    // Funções de controle
    atualizarFiltros: filters.atualizarFiltros,
    atualizarPreferencias: filters.atualizarPreferencias,
    limparFiltros: filters.limparFiltros,
    abrirOrigem,
    prepararDadosExportacao,
    calcularDemonstrativoParaPeriodo: calculations.calcularDemonstrativoParaPeriodo
  };
}