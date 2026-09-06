export interface FaixaPreco {
  min: number;
  max: number | null; // null = unlimited (8+, etc.)
  valor: number;
}

export interface TabelaPrecos {
  id?: string;
  nome?: string;
  faixas: FaixaPreco[];
  usar_valor_fixo_pacote?: boolean;
}

export interface PrecificacaoFotoExtra {
  modelo: 'fixo' | 'global' | 'categoria';
  valorFixo?: number;
  tabelaGlobal?: TabelaPrecos;
  tabelaCategoria?: TabelaPrecos;
}

export interface RegrasCongeladas {
  modelo: string;
  dataCongelamento?: string;
  pacote: {
    id?: string;
    nome?: string;
    valorBase?: number;
    valorFotoExtra: number;
    fotosIncluidas: number;
    categoria?: string;
    categoriaId?: string;
    produtosIncluidos?: any[];
  };
  precificacaoFotoExtra: PrecificacaoFotoExtra;
  produtos?: any[];
}

export interface CalculoPrecoResult {
  valorUnitario: number;
  valorTotal: number;
  faixaAtual?: FaixaPreco;
  economia?: number;
  modeloUsado: 'fixo' | 'global' | 'categoria';
}

export interface CalculoPrecoComCreditoResult {
  valorUnitario: number; // Unit price from the tier
  valorACobrar: number; // Amount to charge this cycle
  valorTotalIdeal: number; // What total would cost if bought at once
  economia: number; // Savings vs base price
  totalExtras: number; // Total accumulated extras
  faixaAtual?: FaixaPreco; // Current price tier
  modeloUsado: 'fixo' | 'global' | 'categoria';
}
