
export interface Cliente {
  id: string;
  nome: string;
  email: string;
  telefone: string;
}

export interface OrigemCliente {
  id: string;
  nome: string;
  cor?: string;
}

export interface ProdutoIncluido {
  produtoId: string;
  quantidade: number;
}

export interface Pacote {
  id: string;
  nome: string;
  categoria_id: string;
  valor_base: number;
  valor_foto_extra: number;
  produtosIncluidos: ProdutoIncluido[];
}

export interface PacoteProduto {
  id: string;
  nome: string;
  preco: number;
  quantidade: number;
}

export interface Template {
  id: string;
  nome: string;
  categoria?: string;
  conteudo: string;
  isPadrao: boolean;
}

export interface Orcamento {
  id: string;
  cliente: Cliente;
  data: string;
  hora: string;
  categoria: string;
  descricao?: string;  // New field for service description (to be shared with Agenda/Workflow)
  detalhes: string;    // Internal notes field (renamed from the old description)
  pacotes: PacoteProduto[];
  valorTotal: number;
  valorManual?: number;
  status: 'rascunho' | 'enviado' | 'fechado' | 'cancelado' | 'pendente' | 'follow-up';
  origemCliente: string;
  criadoEm: string;
}

export interface MetricasOrcamento {
  totalMes: number;
  enviados: number;
  fechados: number;
  cancelados: number;
  pendentes: number;
  taxaConversao: number;
}
