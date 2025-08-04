export interface ProdutoProjeto {
  nome: string;
  quantidade: number;
  valorUnitario: number;
  tipo: 'incluso' | 'manual';
}

export interface Pagamento {
  id: string;
  data: string;
  valor: number;
  metodo: string;
  observacoes?: string;
}

/**
 * ENTIDADE CENTRAL: PROJETO
 * Substitui WorkflowItem, sessionToWorkflow e unifica todos os dados
 * Esta é a única fonte de verdade para todos os trabalhos no sistema
 */
export interface Projeto {
  // Identificação única e imutável
  projectId: string; // proj_uuid_123 - ID único que nunca muda
  
  // Relacionamentos
  clienteId: string;
  orcamentoId?: string; // Se veio de orçamento
  agendamentoId?: string; // Se veio de agendamento
  
  // Dados do projeto
  nome: string; // Nome do cliente
  categoria: string;
  pacote: string;
  descricao: string; // Descrição do serviço
  detalhes: string; // Observações internas
  
  // Contato
  whatsapp: string;
  email: string;
  
  // Cronograma
  dataAgendada: Date;
  horaAgendada: string;
  status: 'agendado' | 'em_andamento' | 'finalizado' | 'cancelado';
  
  // Financeiro (sempre valores numéricos)
  valorPacote: number;
  valorFotosExtra: number;
  qtdFotosExtra: number;
  valorTotalFotosExtra: number;
  valorProdutos: number;
  valorAdicional: number;
  desconto: number;
  total: number;
  valorPago: number;
  restante: number;
  pagamentos: Pagamento[];
  
  // Produtos e serviços
  produtosList: ProdutoProjeto[];
  produto: string; // Produto principal (compatibilidade)
  qtdProduto: number;
  valorTotalProduto: number;
  
  // Configurações de preços (para compatibilidade com workflow)
  valorFotoExtra: number;
  regrasDePrecoFotoExtraCongeladas?: boolean;
  valorFinalAjustado?: number;
  valorOriginalOrcamento?: number;
  percentualAjusteOrcamento?: number;
  
  // Auditoria
  criadoEm: Date;
  atualizadoEm: Date;
  fonte: 'orcamento' | 'agenda' | 'direct';
  dataOriginal?: Date; // Para compatibilidade
}

/**
 * Interface para criação de novos projetos
 */
export interface CriarProjetoInput {
  clienteId: string;
  nome: string;
  categoria: string;
  pacote: string;
  descricao?: string;
  detalhes?: string;
  whatsapp?: string;
  email?: string;
  dataAgendada: Date;
  horaAgendada: string;
  valorPacote?: number;
  fonte: 'orcamento' | 'agenda' | 'direct';
  orcamentoId?: string;
  agendamentoId?: string;
}

/**
 * Interface para atualização de projetos
 */
export interface AtualizarProjetoInput extends Partial<Omit<Projeto, 'projectId' | 'criadoEm'>> {
  atualizadoEm?: Date;
}