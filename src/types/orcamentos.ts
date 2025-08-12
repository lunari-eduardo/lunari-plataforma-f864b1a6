
export interface Cliente {
  id: string;
  nome: string;
  email: string;
  telefone: string;
  endereco?: string;
  observacoes?: string;
  origem?: string;
  // Novos campos opcionais para perfil completo
  dataNascimento?: string;
  conjuge?: {
    nome?: string;
    dataNascimento?: string;
  };
  filhos?: Array<{
    id: string;
    nome?: string;
    dataNascimento?: string;
  }>;
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

// Nova estrutura de pacote principal com valores congelados
export interface PacotePrincipal {
  pacoteId: string;
  nome: string;
  valorCongelado: number; // Preço "congelado" no momento da seleção
  produtosIncluidos: {
    produtoId: string;
    nome: string;
    quantidade: number;
    valorUnitarioCongelado: number; // Preço "congelado" do produto
    tipo: 'incluso';
  }[];
}

// Nova estrutura de produto adicional com valores congelados
export interface ProdutoAdicional {
  produtoId: string;
  nome: string;
  quantidade: number;
  valorUnitarioCongelado: number; // Preço "congelado" do produto
  tipo: 'manual';
}

export interface Orcamento {
  id: string;
  sessionId?: string; // ID único universal para rastrear através de orçamento → agendamento → workflow
  cliente: Cliente;
  data: string;
  hora: string;
  categoria: string;
  descricao?: string;  // New field for service description (to be shared with Agenda/Workflow)
  detalhes: string;    // Internal notes field (renamed from the old description)
  
  // NOVA ARQUITETURA DE DADOS
  pacotePrincipal?: PacotePrincipal;
  produtosAdicionais: ProdutoAdicional[];
  
  // Campos financeiros
  valorFinal: number; // O valor total final calculado
  desconto: number;   // Valor de desconto em R$
  descontoTipo?: 'valor' | 'percentual';
  validade?: string;
  
  // Compatibilidade com sistema antigo
  pacotes?: PacoteProduto[]; // Manter para compatibilidade
  valorTotal?: number;
  
  status: 'rascunho' | 'enviado' | 'fechado' | 'cancelado' | 'pendente' | 'follow-up';
  origemCliente: string;
  criadoEm: string;
  
  // Campos de compatibilidade
  packageId?: string;
  produtosIncluidos?: ProdutoIncluido[];
  valorFotoExtra?: number;
}

export interface MetricasOrcamento {
  totalMes: number;
  enviados: number;
  fechados: number;
  cancelados: number;
  pendentes: number;
  taxaConversao: number;
}
