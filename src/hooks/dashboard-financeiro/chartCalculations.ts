import { storage, STORAGE_KEYS } from '@/utils/localStorage';
import {
  DadosMensais,
  ComposicaoDespesas,
  EvolucaoCategoria,
  HistoricalGoal,
  TransacaoComItem,
} from './types';

const MESES = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];

export const computeDadosMensais = (
  workflowMetricsByYearMetrics: Array<{ mes: number; receita: number }>,
  transacoesDoAno: TransacaoComItem[],
  openingBalance: number,
): DadosMensais[] => {
  const dadosPorMes: Record<number, { receita: number; despesas: number }> = {};

  for (let i = 1; i <= 12; i++) {
    dadosPorMes[i] = { receita: 0, despesas: 0 };
  }

  workflowMetricsByYearMetrics.forEach((m) => {
    dadosPorMes[m.mes].receita += m.receita;
  });

  transacoesDoAno
    .filter((t) => t.status === 'Pago')
    .forEach((transacao) => {
      if (!transacao.dataVencimento) return;
      const mes = parseInt(transacao.dataVencimento.split('-')[1]);
      if (isNaN(mes) || mes < 1 || mes > 12) return;

      if (
        transacao.item?.grupo_principal === 'Receita Não Operacional' ||
        transacao.item?.grupo_principal === 'Receita Operacional'
      ) {
        dadosPorMes[mes].receita += transacao.valor;
      } else if (
        transacao.item &&
        ['Despesa Fixa', 'Despesa Variável', 'Investimento'].includes(transacao.item.grupo_principal)
      ) {
        dadosPorMes[mes].despesas += transacao.valor;
      }
    });

  let acumulado = openingBalance;
  return MESES.map((nome, index) => {
    const dadosMes = dadosPorMes[index + 1];
    const lucro = dadosMes.receita - dadosMes.despesas;
    acumulado += lucro;
    return {
      mes: nome,
      receita: dadosMes.receita,
      despesas: dadosMes.despesas,
      lucro,
      saldoAcumulado: acumulado,
    };
  });
};

export const computeComposicaoDespesas = (transacoesDoAno: TransacaoComItem[]): ComposicaoDespesas[] => {
  const grupos: Record<string, number> = {
    'Despesas Fixas': 0,
    'Despesas Variáveis': 0,
    Investimentos: 0,
  };

  transacoesDoAno
    .filter((t) => t.status === 'Pago' && t.item)
    .forEach((transacao) => {
      if (transacao.item?.grupo_principal === 'Despesa Fixa') {
        grupos['Despesas Fixas'] += transacao.valor;
      } else if (transacao.item?.grupo_principal === 'Despesa Variável') {
        grupos['Despesas Variáveis'] += transacao.valor;
      } else if (transacao.item?.grupo_principal === 'Investimento') {
        grupos['Investimentos'] += transacao.valor;
      }
    });

  const totalDespesas = Object.values(grupos).reduce((sum, valor) => sum + valor, 0);

  return Object.entries(grupos)
    .filter(([_, valor]) => valor > 0)
    .map(([grupo, valor]) => ({
      grupo,
      valor,
      percentual: totalDespesas > 0 ? (valor / totalDespesas) * 100 : 0,
    }))
    .sort((a, b) => b.valor - a.valor);
};

export const computeEvolucaoCategorias = (
  transacoesDoAno: TransacaoComItem[],
  categoriasDisponiveis: string[],
): Record<string, EvolucaoCategoria[]> => {
  const evolucoes: Record<string, EvolucaoCategoria[]> = {};

  categoriasDisponiveis.forEach((categoria) => {
    const dadosPorMes: Record<number, number> = {};

    for (let i = 1; i <= 12; i++) {
      dadosPorMes[i] = 0;
    }

    transacoesDoAno
      .filter((t) => t.status === 'Pago' && t.item?.nome === categoria)
      .forEach((transacao) => {
        if (!transacao.dataVencimento) return;
        const mes = parseInt(transacao.dataVencimento.split('-')[1]);
        if (!isNaN(mes) && mes >= 1 && mes <= 12) {
          dadosPorMes[mes] += transacao.valor;
        }
      });

    evolucoes[categoria] = MESES.map((nome, index) => ({
      mes: nome,
      valor: dadosPorMes[index + 1],
    }));
  });

  return evolucoes;
};

export const computeCategoriasDetalhadas = (transacoesDoAno: TransacaoComItem[]) => {
  const categoriaMap: Record<string, number> = {};

  transacoesDoAno
    .filter(
      (t) =>
        t.status === 'Pago' &&
        t.item?.nome &&
        ['Despesa Fixa', 'Despesa Variável', 'Investimento'].includes(t.item.grupo_principal || ''),
    )
    .forEach((transacao) => {
      const categoria = transacao.item!.nome;
      categoriaMap[categoria] = (categoriaMap[categoria] || 0) + transacao.valor;
    });

  return Object.entries(categoriaMap)
    .map(([categoria, valor]) => ({ categoria, valor }))
    .sort((a, b) => b.valor - a.valor)
    .slice(0, 10);
};

export const deleteHistoricalGoal = (anoSelecionado: string): void => {
  const anoSelecionadoNum = parseInt(anoSelecionado);
  const historicalGoals: HistoricalGoal[] = storage.load(STORAGE_KEYS.HISTORICAL_GOALS, []);
  const novasMetasHistoricas = historicalGoals.filter((goal) => goal.ano !== anoSelecionadoNum);
  storage.save(STORAGE_KEYS.HISTORICAL_GOALS, novasMetasHistoricas);
};
