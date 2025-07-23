
export type TipoTransacao = 'receita' | 'despesa';

export type TipoRecorrencia = 'unica' | 'parcelada' | 'programada';

export type StatusParcela = 'agendado' | 'faturado' | 'pago' | 'cancelado';

export type TipoCategoria = 'despesa_fixa' | 'despesa_variavel' | 'receita_nao_operacional' | 'investimento' | 'equipamento' | 'marketing' | 'acervo';

// Novos tipos para a arquitetura reestruturada
export type GrupoPrincipal = 'Despesa Fixa' | 'Despesa Variável' | 'Investimento' | 'Receita Não Operacional';

export type StatusTransacao = 'Agendado' | 'Pago';

// Nova estrutura: Item Financeiro (Lista Mestre)
export interface ItemFinanceiro {
  id: string;
  nome: string;
  grupo_principal: GrupoPrincipal;
  userId: string;
  ativo: boolean;
  criadoEm: string;
}

// Nova estrutura: Transação Financeira Individual
export interface NovaTransacaoFinanceira {
  id: string;
  item_id: string;
  valor: number;
  data_vencimento: string; // 'YYYY-MM-DD'
  status: StatusTransacao;
  parcelaInfo?: {
    atual: number;
    total: number;
  } | null;
  parcelas?: {
    atual: number;
    total: number;
  } | null;
  observacoes?: string | null;
  userId: string;
  criadoEm: string;
}

// Modelo de Despesa Recorrente (Nova Arquitetura)
export interface ModeloDespesaRecorrente {
  id: string;
  item_id: string;
  valor: number;
  dia_vencimento: number; // Dia do mês (1-31)
  data_inicio: string; // Data de início da recorrência (YYYY-MM-DD)
  observacoes?: string | null;
  userId: string;
  criadoEm: string;
}

// Interface extendida para exibição com dados do item relacionado
export interface TransacaoComItem extends NovaTransacaoFinanceira {
  item: ItemFinanceiro;
}

export interface CategoriaFinanceira {
  id: string;
  nome: string;
  cor: string;
  tipo: TipoCategoria;
  subcategorias?: SubcategoriaFinanceira[];
  userId: string;
  ativo: boolean;
  criadoEm: string;
}

export interface SubcategoriaFinanceira {
  id: string;
  nome: string;
  categoriaId: string;
  userId: string;
  ativo: boolean;
  criadoEm: string;
}

export interface TransacaoFinanceira {
  id: string;
  tipo: TipoTransacao;
  categoriaId: string;
  subcategoriaId?: string;
  categoria?: CategoriaFinanceira;
  subcategoria?: SubcategoriaFinanceira;
  descricao: string;
  valor: number;
  data: string;
  observacoes?: string;
  tipoRecorrencia: TipoRecorrencia;
  quantidadeParcelas?: number;
  dataInicio?: string;
  lançamentoPaiId?: string;
  numeroParcela?: number;
  status: StatusParcela;
  isRecorrente?: boolean;
  userId: string;
  criadoEm: string;
}

export interface ResumoFinanceiro {
  totalReceitasExtras: number;
  totalDespesas: number;
  receitaOperacional: number;
  resultadoMensal: number;
  lucroLiquido: number;
  custoPrevisto: number;
  custoTotal: number;
}

export interface FiltroTransacao {
  tipo?: 'todas' | 'faturadas' | 'agendadas' | 'despesa_fixa' | 'despesa_variavel' | 'receita_nao_operacional';
  categoria?: string;
  mes: number;
  ano: number;
}

export interface IndicadoresFinanceiros {
  custoPrevisto: number;
  custoTotal: number;
}

export interface ConfiguracaoParcelamento {
  tipo: 'unico' | 'parcelado';
  dataInicio: string;
  quantidadeParcelas: number;
}
