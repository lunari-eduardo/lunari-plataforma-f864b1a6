export type ExtratoTipo = 'entrada' | 'saida';
export type ExtratoOrigem = 'workflow' | 'financeiro' | 'cartao';
export type ExtratoStatus = 'Pago' | 'Faturado' | 'Agendado';
export type ExtratoModoData = 'caixa' | 'competencia';

// Linha unificada do extrato
export interface LinhaExtrato {
  id: string;
  data: string; // Data efetiva (pago) ou vencimento
  tipo: ExtratoTipo;
  descricao: string;
  origem: ExtratoOrigem;
  categoria?: string; // Para itens financeiros
  cliente?: string; // Para pagamentos do workflow
  projeto?: string; // Para pagamentos do workflow
  parcela?: {
    atual: number;
    total: number;
  } | null;
  valor: number;
  status: ExtratoStatus;
  observacoes?: string;
  cartao?: string; // Nome do cartão se aplicável
  // IDs de referência para drill-down
  referenciaId: string; // ID da transação ou pagamento original
  referenciaOrigem: ExtratoOrigem;
}

// Resumo do período filtrado
export interface ResumoExtrato {
  totalEntradas: number;
  totalSaidas: number;
  saldoPeriodo: number;
  totalAReceber: number;
  totalAgendado: number;
  totalPago: number;
  ticketMedioEntradas: number;
  percentualPago: number;
}

// Filtros do extrato
export interface FiltrosExtrato {
  dataInicio: string;
  dataFim: string;
  tipo?: ExtratoTipo | 'todos';
  origem?: ExtratoOrigem | 'todos';
  status?: ExtratoStatus | 'todos';
  formaPagamento?: string;
  cliente?: string;
  busca?: string;
}

// Preferências do usuário
export interface PreferenciasExtrato {
  modoData: ExtratoModoData;
  filtrosDefault: Partial<FiltrosExtrato>;
  colunasSelecionadas: string[];
  ordenacao: {
    campo: string;
    direcao: 'asc' | 'desc';
  };
}

// Dados para exportação
export interface DadosExportacaoExtrato {
  periodo: {
    inicio: string;
    fim: string;
  };
  resumo: ResumoExtrato;
  linhas: LinhaExtrato[];
  filtrosAplicados: FiltrosExtrato;
  modoData: ExtratoModoData;
}

// Demonstrativo Financeiro Simplificado
export interface DemonstrativoSimplificado {
  receitas: {
    sessoes: number;
    produtos: number;
    naoOperacionais: number;
    totalReceitas: number;
  };
  despesas: {
    categorias: Array<{
      grupo: string; // 'Despesa Fixa', 'Despesa Variável', etc.
      itens: Array<{
        nome: string;
        valor: number;
      }>;
      total: number;
    }>;
    totalDespesas: number;
  };
  resumoFinal: {
    receitaTotal: number;
    despesaTotal: number;
    resultadoLiquido: number;
    margemLiquida: number; // (resultado / receita) * 100
  };
}