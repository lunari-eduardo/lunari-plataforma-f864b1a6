import { useState, useMemo, useCallback } from 'react';
import { useWorkflowMetricsRealtime } from '@/hooks/useWorkflowMetricsRealtime';
import { useWorkflowMetricsByYear } from '@/hooks/useWorkflowMetricsByYear';
import { calcularPeriodoEfetivo, dividirRealVsFuturo } from '@/modules/finance/domain/periodoEfetivo';
import { preverMeses } from '@/modules/finance/domain/forecast';

import {
  KPIsData,
  MetasData,
  DadosMensais,
  CategoriaGasto,
  EvolucaoCategoria,
  ComposicaoDespesas,
  HistoricalGoal,
  TransacaoComItem,
  getNomeMes,
  getNomeMesCurto,
  parseMonetaryValue,
} from './dashboard-financeiro/types';
import { useEquipmentScanner } from './dashboard-financeiro/useEquipmentScanner';
import { useDashboardQueries } from './dashboard-financeiro/useDashboardQueries';
import {
  computeKPIsData,
  computeROIData,
  computeComparisonData,
  computeMetasData,
} from './dashboard-financeiro/metricsCalculations';
import {
  computeDadosMensais,
  computeComposicaoDespesas,
  computeEvolucaoCategorias,
  computeCategoriasDetalhadas,
  deleteHistoricalGoal,
} from './dashboard-financeiro/chartCalculations';

export type {
  KPIsData,
  MetasData,
  DadosMensais,
  CategoriaGasto,
  EvolucaoCategoria,
  ComposicaoDespesas,
  HistoricalGoal,
  TransacaoComItem,
};

export { getNomeMes, getNomeMesCurto, parseMonetaryValue };

export function useDashboardFinanceiro() {
  const {
    equipmentModalOpen,
    equipmentData,
    handleEquipmentModalClose,
    triggerEquipmentScan,
  } = useEquipmentScanner();

  const {
    anosDisponiveis,
    anoSelecionado,
    setAnoSelecionado,
    mesSelecionado,
    setMesSelecionado,
    dataInicio,
    setDataInicio,
    dataFim,
    setDataFim,
    ano,
    mesNumero,
    openingBalanceData,
    startDate,
    endDate,
    transacoesDoAno,
    transacoesDoAnoLoading,
    periodoAnterior,
    transacoesAnterior,
  } = useDashboardQueries();

  // Métricas do workflow
  const workflowMetricsByYear = useWorkflowMetricsByYear(ano);

  const customStart = mesSelecionado === 'personalizado' && dataInicio ? dataInicio : undefined;
  const customEnd = mesSelecionado === 'personalizado' && dataFim ? dataFim : undefined;
  const workflowMetrics = useWorkflowMetricsRealtime(ano, mesNumero, customStart, customEnd);

  const isYearMode = mesSelecionado === 'ano-completo';
  const workflowPeriod = useMemo(() => {
    if (isYearMode) {
      return {
        receita: workflowMetricsByYear.totalAnual.receita || 0,
        previsto: workflowMetricsByYear.totalAnual.previsto || 0,
        aReceber: workflowMetricsByYear.totalAnual.aReceber || 0,
      };
    }
    return {
      receita: workflowMetrics.receita,
      previsto: workflowMetrics.previsto,
      aReceber: workflowMetrics.aReceber,
    };
  }, [isYearMode, workflowMetricsByYear, workflowMetrics]);

  const workflowMetricsAnterior = useWorkflowMetricsRealtime(periodoAnterior.ano, periodoAnterior.mes);
  const workflowMetricsByYearAnterior = useWorkflowMetricsByYear(periodoAnterior.ano);

  // Transações do período selecionado
  const transacoesFiltradasPorPeriodo = transacoesDoAno;

  // KPIs
  const kpisData = useMemo(() => {
    return computeKPIsData(workflowPeriod, transacoesFiltradasPorPeriodo);
  }, [workflowPeriod, transacoesFiltradasPorPeriodo]);

  // ROI Anual
  const roiData = useMemo(() => {
    return computeROIData(transacoesDoAno, workflowMetricsByYear.totalAnual.receita);
  }, [transacoesDoAno, workflowMetricsByYear]);

  // Comparações com período anterior
  const comparisonData = useMemo(() => {
    return computeComparisonData({
      mesSelecionado,
      anoSelecionado,
      isYearMode,
      kpisData,
      periodoAnterior,
      transacoesAnterior,
      workflowMetricsAnteriorReceita: workflowMetricsAnterior.receita,
      workflowMetricsByYearAnteriorMetrics: workflowMetricsByYearAnterior.metricsPorMes,
    });
  }, [
    mesSelecionado,
    anoSelecionado,
    isYearMode,
    kpisData,
    periodoAnterior,
    transacoesAnterior,
    workflowMetricsAnterior.receita,
    workflowMetricsByYearAnterior.metricsPorMes,
  ]);

  // Metas
  const metasData = useMemo(() => {
    return computeMetasData(kpisData, mesSelecionado, ano);
  }, [kpisData, mesSelecionado, ano]);

  // Dados mensais para gráficos
  const dadosMensais = useMemo(() => {
    return computeDadosMensais(
      workflowMetricsByYear.metricsPorMes,
      transacoesDoAno,
      openingBalanceData?.valor ?? 0,
    );
  }, [workflowMetricsByYear.metricsPorMes, transacoesDoAno, openingBalanceData?.valor]);

  // Período efetivo e previsão
  const periodoEfetivo = useMemo(() => {
    const modo: 'mensal' | 'anual' | 'personalizado' =
      mesSelecionado === 'ano-completo'
        ? 'anual'
        : mesSelecionado === 'personalizado'
        ? 'personalizado'
        : 'mensal';
    const opening = openingBalanceData?.valor ?? 0;
    const loading = workflowMetricsByYear.isLoading || transacoesDoAnoLoading;
    return calcularPeriodoEfetivo(ano, modo, dadosMensais, new Date(), {
      openingBalance: opening,
      loading,
    });
  }, [
    ano,
    mesSelecionado,
    dadosMensais,
    openingBalanceData?.valor,
    workflowMetricsByYear.isLoading,
    transacoesDoAnoLoading,
  ]);

  const { dadosMensaisReais, previsaoMensais } = useMemo(() => {
    if (periodoEfetivo.modo !== 'anual') {
      return { dadosMensaisReais: dadosMensais, previsaoMensais: [] as any[] };
    }
    const { reais } = dividirRealVsFuturo(dadosMensais, periodoEfetivo);
    const previsao = preverMeses(dadosMensais, periodoEfetivo.ultimoMesComDados);
    return { dadosMensaisReais: reais, previsaoMensais: previsao };
  }, [dadosMensais, periodoEfetivo]);

  // Composição de despesas
  const composicaoDespesas = useMemo(() => {
    return computeComposicaoDespesas(transacoesDoAno);
  }, [transacoesDoAno]);

  // Categorias disponíveis e evolução
  const categoriasDisponiveis = useMemo(() => {
    const categorias = new Set<string>();
    transacoesDoAno.forEach((transacao) => {
      if (transacao.item?.nome) {
        categorias.add(transacao.item.nome);
      }
    });
    const categoriasArray = Array.from(categorias);
    return categoriasArray.length > 0 ? categoriasArray : ['Aluguel'];
  }, [transacoesDoAno]);

  const [categoriaSelecionada, setCategoriaSelecionada] = useState(
    () => categoriasDisponiveis[0] || 'Aluguel',
  );

  const evolucaoCategoria = useMemo(() => {
    return computeEvolucaoCategorias(transacoesDoAno, categoriasDisponiveis);
  }, [transacoesDoAno, categoriasDisponiveis]);

  // Ranking detalhado de categorias
  const categoriasDetalhadas = useMemo(() => {
    return computeCategoriasDetalhadas(transacoesDoAno);
  }, [transacoesDoAno]);

  const excluirMetaAnual = useCallback(() => {
    deleteHistoricalGoal(anoSelecionado);
  }, [anoSelecionado]);

  return {
    // Estados dos filtros
    anoSelecionado,
    setAnoSelecionado,
    mesSelecionado,
    setMesSelecionado,
    anosDisponiveis,
    dataInicio,
    setDataInicio,
    dataFim,
    setDataFim,
    startDate,
    endDate,
    categoriaSelecionada,
    setCategoriaSelecionada,
    categoriasDisponiveis,

    // Dados calculados
    kpisData,
    metasData,
    dadosMensais,
    dadosMensaisReais,
    previsaoMensais,
    openingBalance: openingBalanceData?.valor ?? 0,
    openingBalanceOrigem: openingBalanceData?.origem ?? 'zero',
    openingBalanceAnoBase: openingBalanceData?.anoBase ?? ano - 1,
    periodoEfetivo,
    evolucaoCategoria,
    composicaoDespesas,
    roiData,
    comparisonData,
    categoriasDetalhadas,

    // Funções auxiliares
    getNomeMes,
    getNomeMesCurto,
    excluirMetaAnual,
    triggerEquipmentScan,

    // Dados filtrados
    transacoesFiltradas: transacoesFiltradasPorPeriodo,

    // Estados do modal de equipamentos
    equipmentModalOpen,
    equipmentData,
    handleEquipmentModalClose,
  };
}
