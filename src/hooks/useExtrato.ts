/**
 * Hook principal do extrato - 100% SUPABASE COM PAGINAÇÃO + REGIME
 */

import { useState, useCallback, useMemo } from 'react';
import { LinhaExtrato, FiltrosExtrato, ExtratoPaginacao } from '@/types/extrato';
import { useExtratoData } from '@/hooks/useExtratoData';
import { useExtratoFiltersState, aplicarFiltrosClientSide } from '@/hooks/useExtratoFilters';
import { useExtratoCalculationsSupabase } from '@/hooks/useExtratoCalculationsSupabase';
import { useRegimeContabil } from '@/hooks/useRegimeContabil';
import { getDefaultPeriod } from '@/utils/extratoUtils';

const PAGE_SIZE = 100;

export function useExtrato() {
  const [paginaAtual, setPaginaAtual] = useState(1);

  // Regime contábil (caixa | competência) — global, sincronizado entre telas
  const { regime, setRegime } = useRegimeContabil();

  const { inicioMes, fimMes } = getDefaultPeriod();
  const [periodoFiltro, setPeriodoFiltro] = useState({
    dataInicio: inicioMes,
    dataFim: fimMes
  });

  // Estado dos filtros (único, alimenta query server-side e aplicação client-side)
  const filtersState = useExtratoFiltersState();

  // ============= BUSCAR DADOS COM FILTROS SERVER-SIDE =============
  const extratoData = useExtratoData({
    dataInicio: periodoFiltro.dataInicio,
    dataFim: periodoFiltro.dataFim,
    page: paginaAtual,
    pageSize: PAGE_SIZE,
    regime,
    tipo: filtersState.filtros.tipo,
    origem: filtersState.filtros.origem,
    status: filtersState.filtros.status,
  });

  // Aplicar filtros client-side restantes (busca/cliente/ordenação) sobre página atual
  const linhasFiltradas = useMemo(
    () => aplicarFiltrosClientSide(
      extratoData.linhasExtrato,
      filtersState.filtros,
      filtersState.preferencias
    ),
    [extratoData.linhasExtrato, filtersState.filtros, filtersState.preferencias]
  );

  const calculations = useExtratoCalculationsSupabase(
    linhasFiltradas,
    filtersState.filtros,
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
    // Reset paginação ao mudar filtros server-side
    if (
      novosFiltros.tipo !== undefined ||
      novosFiltros.origem !== undefined ||
      novosFiltros.status !== undefined
    ) {
      setPaginaAtual(1);
    }
    filtersState.atualizarFiltros(novosFiltros);
  }, [filtersState]);

  const limparFiltros = useCallback(() => {
    const { inicioMes, fimMes } = getDefaultPeriod();
    setPaginaAtual(1);
    setPeriodoFiltro({
      dataInicio: inicioMes,
      dataFim: fimMes
    });
    filtersState.limparFiltros();
  }, [filtersState]);

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
      filtrosAplicados: filtersState.filtros,
      regime
    };
  }, [periodoFiltro, calculations.resumo, calculations.linhasComSaldo, filtersState.filtros, regime]);

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
      ...filtersState.filtros,
      dataInicio: periodoFiltro.dataInicio,
      dataFim: periodoFiltro.dataFim
    },
    preferencias: filtersState.preferencias,
    regime,
    setRegime: handleSetRegime,
    atualizarFiltros,
    atualizarPreferencias: filtersState.atualizarPreferencias,
    limparFiltros,
    abrirOrigem,
    prepararDadosExportacao,
    calcularDemonstrativoParaPeriodo: calculations.calcularDemonstrativoParaPeriodo
  };
}
