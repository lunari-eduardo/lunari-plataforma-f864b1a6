import { GoalsIntegrationService } from '@/services/GoalsIntegrationService';
import { KPIsData, MetasData, TransacaoComItem } from './types';

export const computeKPIsData = (
  workflowPeriod: { receita: number; previsto: number; aReceber: number },
  transacoesFiltradas: TransacaoComItem[],
): KPIsData => {
  const receitaOperacionalWorkflow = workflowPeriod.receita;
  const valorPrevisto = workflowPeriod.previsto;
  const aReceber = workflowPeriod.aReceber;

  const receitaOperacionalManual = transacoesFiltradas
    .filter((t) => t.status === 'Pago' && t.item?.grupo_principal === 'Receita Operacional')
    .reduce((sum, t) => sum + t.valor, 0);

  const receitaOperacional = receitaOperacionalWorkflow + receitaOperacionalManual;

  const receitaNaoOperacional = transacoesFiltradas
    .filter((t) => t.status === 'Pago' && t.item?.grupo_principal === 'Receita Não Operacional')
    .reduce((sum, t) => sum + t.valor, 0);

  const totalReceita = receitaOperacional + receitaNaoOperacional;

  const totalDespesas = transacoesFiltradas
    .filter(
      (t) =>
        t.status === 'Pago' &&
        t.item &&
        ['Despesa Fixa', 'Despesa Variável', 'Investimento'].includes(t.item.grupo_principal),
    )
    .reduce((sum, t) => sum + t.valor, 0);

  const totalLucro = totalReceita - totalDespesas;
  const saldoTotal = totalLucro;

  return {
    totalReceita,
    valorPrevisto,
    aReceber,
    totalDespesas,
    totalLucro,
    saldoTotal,
    receitaOperacional,
    receitaNaoOperacional,
    receitaOperacionalManual,
  };
};

export const computeROIData = (
  transacoesDoAno: TransacaoComItem[],
  totalReceitaWorkflowAnual: number,
) => {
  const totalInvestimento = transacoesDoAno
    .filter((t) => t.status === 'Pago' && t.item?.grupo_principal === 'Investimento')
    .reduce((sum, t) => sum + t.valor, 0);

  const receitaOpManualAnual = transacoesDoAno
    .filter((t) => t.status === 'Pago' && t.item?.grupo_principal === 'Receita Operacional')
    .reduce((sum, t) => sum + t.valor, 0);

  const receitaNaoOpAnual = transacoesDoAno
    .filter((t) => t.status === 'Pago' && t.item?.grupo_principal === 'Receita Não Operacional')
    .reduce((sum, t) => sum + t.valor, 0);

  const receitaAnual = totalReceitaWorkflowAnual + receitaOpManualAnual + receitaNaoOpAnual;

  const despesasAnuais = transacoesDoAno
    .filter(
      (t) =>
        t.status === 'Pago' &&
        t.item &&
        ['Despesa Fixa', 'Despesa Variável', 'Investimento'].includes(t.item.grupo_principal),
    )
    .reduce((sum, t) => sum + t.valor, 0);

  const lucroAnual = receitaAnual - despesasAnuais;
  const roi = totalInvestimento > 0 ? (lucroAnual / totalInvestimento) * 100 : 0;

  return {
    totalInvestimento,
    roi: Math.max(0, roi),
  };
};

export const computeComparisonData = (params: {
  mesSelecionado: string;
  anoSelecionado: string;
  isYearMode: boolean;
  kpisData: KPIsData;
  periodoAnterior: { ano: number; mes: number | undefined };
  transacoesAnterior: TransacaoComItem[];
  workflowMetricsAnteriorReceita: number;
  workflowMetricsByYearAnteriorMetrics: Array<{ mes: number; receita: number }>;
}) => {
  const {
    mesSelecionado,
    anoSelecionado,
    isYearMode,
    kpisData,
    periodoAnterior,
    transacoesAnterior,
    workflowMetricsAnteriorReceita,
    workflowMetricsByYearAnteriorMetrics,
  } = params;

  let labelComparacao = '';
  if (mesSelecionado && mesSelecionado !== 'ano-completo') {
    labelComparacao = 'em comparação ao mês anterior';
  } else {
    labelComparacao = 'em comparação ao ano anterior';
  }

  let limitMonth = 12;
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  if (isYearMode && parseInt(anoSelecionado) === currentYear) {
    limitMonth = currentMonth;
  }

  let receitaAnterior = 0;
  if (isYearMode) {
    receitaAnterior = workflowMetricsByYearAnteriorMetrics
      .filter((m) => m.mes <= limitMonth)
      .reduce((sum, m) => sum + m.receita, 0);
  } else {
    receitaAnterior = workflowMetricsAnteriorReceita;
  }

  const transacoesAnteriorFiltradas = transacoesAnterior.filter((transacao) => {
    if (!transacao.dataVencimento) return false;
    const [, mesTransacao] = transacao.dataVencimento.split('-').map(Number);
    if (periodoAnterior.mes) {
      return mesTransacao === periodoAnterior.mes;
    } else {
      return mesTransacao <= limitMonth;
    }
  });

  const receitasExtrasAnterior = transacoesAnteriorFiltradas
    .filter((t) => t.status === 'Pago' && t.item?.grupo_principal === 'Receita Não Operacional')
    .reduce((sum, t) => sum + t.valor, 0);

  const receitaOpManualAnterior = transacoesAnteriorFiltradas
    .filter((t) => t.status === 'Pago' && t.item?.grupo_principal === 'Receita Operacional')
    .reduce((sum, t) => sum + t.valor, 0);

  receitaAnterior += receitasExtrasAnterior + receitaOpManualAnterior;

  const despesasAnterior = transacoesAnteriorFiltradas
    .filter(
      (t) =>
        t.status === 'Pago' &&
        t.item &&
        ['Despesa Fixa', 'Despesa Variável', 'Investimento'].includes(t.item.grupo_principal),
    )
    .reduce((sum, t) => sum + t.valor, 0);

  const lucroAnterior = receitaAnterior - despesasAnterior;

  const calcularVariacao = (atual: number, anterior: number): number | null => {
    if (anterior === 0) return atual > 0 ? 100 : null;
    return ((atual - anterior) / anterior) * 100;
  };

  return {
    labelComparacao,
    variacaoReceita: calcularVariacao(kpisData.totalReceita, receitaAnterior),
    variacaoLucro: calcularVariacao(kpisData.totalLucro, lucroAnterior),
    variacaoDespesas: calcularVariacao(kpisData.totalDespesas, despesasAnterior),
  };
};

export const computeMetasData = (
  kpisData: KPIsData,
  mesSelecionado: string,
  ano: number,
): MetasData => {
  let metaReceitaAnual = 0;
  let metaLucroAnual = 0;

  try {
    const goalsData = GoalsIntegrationService.getAnnualGoals();
    metaReceitaAnual = goalsData.revenue;
    metaLucroAnual = goalsData.profit;
  } catch (error) {
    console.warn('Erro ao carregar metas da precificação:', error);
  }

  let metaReceita = metaReceitaAnual;
  let metaLucro = metaLucroAnual;
  let metaReceitaProporcional = metaReceitaAnual;
  let metaLucroProporcional = metaLucroAnual;

  const hoje = new Date();
  const anoCorrente = hoje.getFullYear();
  const mesCorrente = hoje.getMonth() + 1;

  if (mesSelecionado && mesSelecionado !== 'ano-completo' && mesSelecionado !== 'personalizado') {
    metaReceita = metaReceitaAnual / 12;
    metaLucro = metaLucroAnual / 12;
    metaReceitaProporcional = metaReceita;
    metaLucroProporcional = metaLucro;
  } else if (mesSelecionado === 'ano-completo') {
    let mesesDecorridos = 12;
    if (ano > anoCorrente) mesesDecorridos = 0;
    else if (ano === anoCorrente) mesesDecorridos = mesCorrente;
    metaReceitaProporcional = (metaReceitaAnual * mesesDecorridos) / 12;
    metaLucroProporcional = (metaLucroAnual * mesesDecorridos) / 12;
  }

  return {
    metaReceita,
    metaLucro,
    metaReceitaProporcional,
    metaLucroProporcional,
    receitaAtual: kpisData.totalReceita,
    lucroAtual: kpisData.totalLucro,
  };
};
