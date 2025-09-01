export interface KPIsData {
  totalReceita: number;
  valorPrevisto: number;
  aReceber: number;
  totalDespesas: number;
  totalLucro: number;
  saldoTotal: number;
}

export interface MetasData {
  metaReceita: number;
  metaLucro: number;
  receitaAtual: number;
  lucroAtual: number;
}

export interface DadosMensais {
  mes: string;
  receita: number;
  lucro: number;
}

export interface ComposicaoDespesas {
  grupo: string;
  valor: number;
  percentual: number;
}

export interface ROIData {
  totalInvestimento: number;
  roi: number;
}

export interface ComparisonData {
  labelComparacao: string;
  variacaoReceita: number | null;
  variacaoLucro: number | null;
  variacaoDespesas: number | null;
}

export interface FiltersProps {
  anoSelecionado: string;
  setAnoSelecionado: (ano: string) => void;
  mesSelecionado: string;
  setMesSelecionado: (mes: string) => void;
  anosDisponiveis: number[];
  getNomeMes: (mes: string) => string;
}

export interface KpiCardsProps {
  kpisData: KPIsData;
  comparisonData: ComparisonData;
}

export interface GoalsDonutsProps {
  metasData: MetasData;
}

export interface ChartsBlockProps {
  dadosMensais: DadosMensais[];
  composicaoDespesas: ComposicaoDespesas[];
  roiData: ROIData;
}

export interface EquipmentModalGatewayProps {
  equipmentModalOpen: boolean;
  equipmentData: {
    nome: string;
    valor: number;
    data: string;
    allTransactionIds: string[];
  } | null;
  handleEquipmentModalClose: () => void;
}