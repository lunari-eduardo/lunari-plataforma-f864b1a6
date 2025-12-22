/**
 * Hook principal do extrato - 100% SUPABASE COM PAGINAÇÃO
 */

import { useState, useCallback, useMemo } from 'react';
import { LinhaExtrato, FiltrosExtrato, ExtratoPaginacao } from '@/types/extrato';
import { useExtratoData } from '@/hooks/useExtratoData';
import { useExtratoFilters } from '@/hooks/useExtratoFilters';
import { useExtratoCalculationsSupabase } from '@/hooks/useExtratoCalculationsSupabase';
import { getDefaultPeriod } from '@/utils/extratoUtils';

const PAGE_SIZE = 50;

export function useExtrato() {
  // ============= ESTADO DE PAGINAÇÃO =============
  const [paginaAtual, setPaginaAtual] = useState(1);

  // ============= ESTADO DE PERÍODO (para filtros server-side) =============
  const { inicioMes, fimMes } = getDefaultPeriod();
  const [periodoFiltro, setPeriodoFiltro] = useState({
    dataInicio: inicioMes,
    dataFim: fimMes
  });

  // ============= BUSCAR DADOS COM FILTROS SERVER-SIDE =============
  const extratoData = useExtratoData({
    dataInicio: periodoFiltro.dataInicio,
    dataFim: periodoFiltro.dataFim,
    page: paginaAtual,
    pageSize: PAGE_SIZE
  });

  // ============= FILTROS SECUNDÁRIOS (CLIENT-SIDE) =============
  const filters = useExtratoFilters(extratoData.linhasExtrato);
  
  // ============= CÁLCULOS =============
  const calculations = useExtratoCalculationsSupabase(
    filters.linhasFiltradas, 
    filters.filtros
  );

  // ============= CONTROLE DE PAGINAÇÃO =============
  const paginacao: ExtratoPaginacao & {
    irParaPagina: (p: number) => void;
    proximaPagina: () => void;
    paginaAnterior: () => void;
  } = useMemo(() => ({
    page: paginaAtual,
    pageSize: PAGE_SIZE,
    totalCount: extratoData.totalCount,
    totalPages: extratoData.totalPages,
    irParaPagina: (novaPagina: number) => {
      setPaginaAtual(Math.max(1, Math.min(novaPagina, extratoData.totalPages || 1)));
    },
    proximaPagina: () => {
      if (paginaAtual < (extratoData.totalPages || 1)) {
        setPaginaAtual(p => p + 1);
      }
    },
    paginaAnterior: () => {
      if (paginaAtual > 1) {
        setPaginaAtual(p => p - 1);
      }
    }
  }), [paginaAtual, extratoData.totalCount, extratoData.totalPages]);

  // ============= SINCRONIZAR FILTROS DE PERÍODO =============
  const atualizarFiltros = useCallback((novosFiltros: Partial<FiltrosExtrato>) => {
    // Se mudou período, atualiza estado server-side e reseta página
    if (novosFiltros.dataInicio !== undefined || novosFiltros.dataFim !== undefined) {
      setPaginaAtual(1); // Reset para primeira página
      setPeriodoFiltro(prev => ({
        dataInicio: novosFiltros.dataInicio ?? prev.dataInicio,
        dataFim: novosFiltros.dataFim ?? prev.dataFim
      }));
    }
    
    // Atualiza filtros client-side também
    filters.atualizarFiltros(novosFiltros);
  }, [filters]);

  // ============= LIMPAR FILTROS =============
  const limparFiltros = useCallback(() => {
    const { inicioMes, fimMes } = getDefaultPeriod();
    setPaginaAtual(1);
    setPeriodoFiltro({
      dataInicio: inicioMes,
      dataFim: fimMes
    });
    filters.limparFiltros();
  }, [filters]);

  // ============= DRILL-DOWN =============
  const abrirOrigem = useCallback((linha: LinhaExtrato) => {
    console.log('📊 Abrir origem:', linha);
    // TODO: Implementar modais de detalhes
  }, []);

  // ============= EXPORTAÇÃO =============
  const prepararDadosExportacao = useCallback(() => {
    return {
      periodo: {
        inicio: periodoFiltro.dataInicio,
        fim: periodoFiltro.dataFim
      },
      resumo: calculations.resumo,
      linhas: calculations.linhasComSaldo,
      filtrosAplicados: filters.filtros
    };
  }, [periodoFiltro, calculations.resumo, calculations.linhasComSaldo, filters.filtros]);

  return {
    // Dados principais
    linhas: calculations.linhasComSaldo,
    resumo: calculations.resumo,
    demonstrativo: calculations.demonstrativo,
    
    // Paginação
    paginacao,
    isLoading: extratoData.isLoading,
    
    // Estados de filtros
    filtros: {
      ...filters.filtros,
      dataInicio: periodoFiltro.dataInicio,
      dataFim: periodoFiltro.dataFim
    },
    preferencias: filters.preferencias,
    
    // Funções de controle
    atualizarFiltros,
    atualizarPreferencias: filters.atualizarPreferencias,
    limparFiltros,
    abrirOrigem,
    prepararDadosExportacao,
    calcularDemonstrativoParaPeriodo: calculations.calcularDemonstrativoParaPeriodo
  };
}
