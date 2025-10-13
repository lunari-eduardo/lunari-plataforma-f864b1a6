/**
 * Hook principal do extrato - 100% SUPABASE
 */

import { useCallback } from 'react';
import { LinhaExtrato } from '@/types/extrato';
import { useExtratoData } from '@/hooks/useExtratoData';
import { useExtratoFilters } from '@/hooks/useExtratoFilters';
import { useExtratoCalculationsSupabase } from '@/hooks/useExtratoCalculationsSupabase';

export function useExtrato() {
  // ============= HOOKS ESPECIALIZADOS SUPABASE =============
  const extratoData = useExtratoData();
  const filters = useExtratoFilters(extratoData.linhasExtrato);
  const calculations = useExtratoCalculationsSupabase(
    filters.linhasFiltradas, 
    filters.filtros
  );

  // ============= DRILL-DOWN =============
  const abrirOrigem = useCallback((linha: LinhaExtrato) => {
    console.log('📊 Abrir origem:', linha);
    // TODO: Implementar modais de detalhes
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