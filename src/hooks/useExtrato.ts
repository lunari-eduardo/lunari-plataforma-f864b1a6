/**
 * Hook principal do extrato - 100% SUPABASE COM PAGINAÇÃO + REGIME
 */

import { useState, useCallback, useMemo } from 'react';
import { LinhaExtrato, FiltrosExtrato, ExtratoPaginacao } from '@/types/extrato';
import { useExtratoData } from '@/hooks/useExtratoData';
import { useExtratoFilters } from '@/hooks/useExtratoFilters';
import { useExtratoCalculationsSupabase } from '@/hooks/useExtratoCalculationsSupabase';
import { useRegimeContabil } from '@/hooks/useRegimeContabil';
import { getDefaultPeriod } from '@/utils/extratoUtils';

const PAGE_SIZE = 50;

export function useExtrato() {
  const [paginaAtual, setPaginaAtual] = useState(1);

  // Regime contábil (caixa | competência) — global, sincronizado entre telas
  const { regime, setRegime } = useRegimeContabil();

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
    pageSize: PAGE_SIZE,
    regime
  });

  const filters = useExtratoFilters(extratoData.linhasExtrato);
  
  const calculations = useExtratoCalculationsSupabase(
    filters.linhasFiltradas, 
    filters.filtros,
    regime
  );

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

  const atualizarFiltros = useCallback((novosFiltros: Partial<FiltrosExtrato>) => {
    if (novosFiltros.dataInicio !== undefined || novosFiltros.dataFim !== undefined) {
      setPaginaAtual(1);
      setPeriodoFiltro(prev => ({
        dataInicio: novosFiltros.dataInicio ?? prev.dataInicio,
        dataFim: novosFiltros.dataFim ?? prev.dataFim
      }));
    }
    filters.atualizarFiltros(novosFiltros);
  }, [filters]);

  const limparFiltros = useCallback(() => {
    const { inicioMes, fimMes } = getDefaultPeriod();
    setPaginaAtual(1);
    setPeriodoFiltro({
      dataInicio: inicioMes,
      dataFim: fimMes
    });
    filters.limparFiltros();
  }, [filters]);

  const abrirOrigem = useCallback((linha: LinhaExtrato) => {
    console.log('📊 Abrir origem:', linha);
  }, []);

  const prepararDadosExportacao = useCallback(() => {
    return {
      periodo: {
        inicio: periodoFiltro.dataInicio,
        fim: periodoFiltro.dataFim
      },
      resumo: calculations.resumo,
      linhas: calculations.linhasComSaldo,
      filtrosAplicados: filters.filtros,
      regime
    };
  }, [periodoFiltro, calculations.resumo, calculations.linhasComSaldo, filters.filtros, regime]);

  // Reset para primeira página ao trocar regime
  const handleSetRegime = useCallback((novoRegime: typeof regime) => {
    setPaginaAtual(1);
    setRegime(novoRegime);
  }, [setRegime]);

  return {
    linhas: calculations.linhasComSaldo,
    resumo: calculations.resumo,
    demonstrativo: calculations.demonstrativo,
    paginacao,
    isLoading: extratoData.isLoading,
    filtros: {
      ...filters.filtros,
      dataInicio: periodoFiltro.dataInicio,
      dataFim: periodoFiltro.dataFim
    },
    preferencias: filters.preferencias,
    regime,
    setRegime: handleSetRegime,
    atualizarFiltros,
    atualizarPreferencias: filters.atualizarPreferencias,
    limparFiltros,
    abrirOrigem,
    prepararDadosExportacao,
    calcularDemonstrativoParaPeriodo: calculations.calcularDemonstrativoParaPeriodo
  };
}
