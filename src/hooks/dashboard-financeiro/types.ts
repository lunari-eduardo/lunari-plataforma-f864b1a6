export interface KPIsData {
  totalReceita: number;
  valorPrevisto: number;
  aReceber: number;
  totalDespesas: number;
  totalLucro: number;
  saldoTotal: number;
  receitaOperacional: number;
  receitaNaoOperacional: number;
  receitaOperacionalManual: number;
}

export interface MetasData {
  metaReceita: number;
  metaLucro: number;
  receitaAtual: number;
  lucroAtual: number;
  metaReceitaProporcional: number;
  metaLucroProporcional: number;
}

export interface DadosMensais {
  mes: string;
  receita: number;
  despesas: number;
  lucro: number;
  saldoAcumulado: number;
}

export interface CategoriaGasto {
  categoria: string;
  valor: number;
}

export interface EvolucaoCategoria {
  mes: string;
  valor: number;
}

export interface ComposicaoDespesas {
  grupo: string;
  valor: number;
  percentual: number;
}

export interface HistoricalGoal {
  ano: number;
  metaFaturamento: number;
  metaLucro: number;
  dataCriacao: string;
  margemLucroDesejada: number;
}

export interface TransacaoComItem {
  id: string;
  itemId: string;
  valor: number;
  dataVencimento: string;
  status: string;
  observacoes?: string;
  item?: {
    id: string;
    nome: string;
    grupo_principal: string;
  } | null;
}

export const getNomeMes = (numeroMes: string): string => {
  const meses = [
    'Janeiro',
    'Fevereiro',
    'Março',
    'Abril',
    'Maio',
    'Junho',
    'Julho',
    'Agosto',
    'Setembro',
    'Outubro',
    'Novembro',
    'Dezembro',
  ];
  const numero = parseInt(numeroMes);
  return meses[numero - 1] || '';
};

export const getNomeMesCurto = (numeroMes: string): string => {
  const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  const numero = parseInt(numeroMes);
  return meses[numero - 1] || '';
};

export const parseMonetaryValue = (value: string | number): number => {
  if (typeof value === 'number') return value;
  if (!value || typeof value !== 'string') return 0;

  const cleanValue = value
    .replace(/R\$\s*/g, '')
    .replace(/\./g, '')
    .replace(',', '.')
    .trim();

  const parsed = parseFloat(cleanValue);
  return isNaN(parsed) ? 0 : parsed;
};
