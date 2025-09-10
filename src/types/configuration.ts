/**
 * Tipos centralizados para sistema de Configurações
 * Preparados para migração Supabase com compatibilidade multi-usuário
 */

// ============= TIPOS BASE =============

export interface Categoria {
  id: string;
  user_id?: string; // Para compatibilidade Supabase multi-usuário
  nome: string;
  cor: string;
  created_at?: string;
  updated_at?: string;
}

export interface Produto {
  id: string;
  user_id?: string; // Para compatibilidade Supabase multi-usuário
  nome: string;
  preco_custo: number;
  preco_venda: number;
  created_at?: string;
  updated_at?: string;
}

export interface ProdutoIncluido {
  produtoId: string;
  quantidade: number;
}

export interface Pacote {
  id: string;
  user_id?: string; // Para compatibilidade Supabase multi-usuário
  nome: string;
  categoria_id: string;
  valor_base: number;
  valor_foto_extra: number;
  produtosIncluidos: ProdutoIncluido[];
  created_at?: string;
  updated_at?: string;
}

export interface EtapaTrabalho {
  id: string;
  user_id?: string; // Para compatibilidade Supabase multi-usuário
  nome: string;
  cor: string;
  ordem: number;
  created_at?: string;
  updated_at?: string;
}

// ============= TIPOS PARA FORMULÁRIOS =============

export interface PacoteFormData {
  nome: string;
  categoria_id: string;
  valor_base: number;
  valor_foto_extra: number;
  produtosIncluidos: ProdutoIncluido[];
}

// ============= TIPOS PARA PROPS DE COMPONENTES =============

export interface PacoteFormProps {
  initialData?: PacoteFormData;
  categorias: Categoria[];
  produtos: Produto[];
  onSubmit: (data: PacoteFormData) => void;
  onCancel?: () => void;
  submitLabel?: string;
  isEditing?: boolean;
}

export interface EditPacoteModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pacote: Pacote | null;
  categorias: Categoria[];
  produtos: Produto[];
  onSave: (id: string, dados: Partial<Pacote>) => void;
}

// ============= TIPOS PARA CONFIGURAÇÃO GLOBAL =============

export interface ConfigurationState {
  categorias: Categoria[];
  pacotes: Pacote[];
  produtos: Produto[];
  etapas: EtapaTrabalho[];
  isLoadingCategorias?: boolean;
  isLoadingPacotes?: boolean;
  isLoadingProdutos?: boolean;
  isLoadingEtapas?: boolean;
}

export interface ConfigurationActions {
  // Categorias
  adicionarCategoria: (categoria: Omit<Categoria, 'id'>) => void;
  atualizarCategoria: (id: string, dados: Partial<Categoria>) => void;
  removerCategoria: (id: string) => Promise<boolean>;
  
  // Pacotes
  adicionarPacote: (pacote: Omit<Pacote, 'id'>) => void;
  atualizarPacote: (id: string, dados: Partial<Pacote>) => void;
  removerPacote: (id: string) => Promise<boolean>;
  
  // Produtos
  adicionarProduto: (produto: Omit<Produto, 'id'>) => void;
  atualizarProduto: (id: string, dados: Partial<Produto>) => void;
  removerProduto: (id: string) => Promise<boolean>;
  
  // Etapas de Trabalho
  adicionarEtapa: (etapa: Omit<EtapaTrabalho, 'id' | 'ordem'>) => void;
  atualizarEtapa: (id: string, dados: Partial<EtapaTrabalho>) => void;
  removerEtapa: (id: string) => Promise<boolean>;
  moverEtapa: (id: string, direcao: 'cima' | 'baixo') => void;
}

// ============= CONSTANTES DE STORAGE (LEGACY - usar adapter) =============

/**
 * @deprecated Use ConfigurationStorageAdapter instead
 * Mantido apenas para compatibilidade durante migração
 */
export const CONFIGURATION_STORAGE_KEYS = {
  CATEGORIAS: 'configuracoes_categorias',
  PACOTES: 'configuracoes_pacotes', 
  PRODUTOS: 'configuracoes_produtos',
  ETAPAS: 'lunari_workflow_status'
} as const;

// ============= DADOS PADRÃO =============

export const DEFAULT_CATEGORIAS: Categoria[] = [
  { id: "018fded5-6b5c-7a2f-8c3d-9e4f5a6b7c8d", nome: "Gestante", cor: "#FF9500" },
  { id: "018fded5-6b5c-7a2f-8c3d-9e4f5a6b7c8e", nome: "Newborn", cor: "#34C759" },
  { id: "018fded5-6b5c-7a2f-8c3d-9e4f5a6b7c8f", nome: "Família", cor: "#5856D6" },
  { id: "018fded5-6b5c-7a2f-8c3d-9e4f5a6b7c90", nome: "Casamento", cor: "#FF2D55" },
  { id: "018fded5-6b5c-7a2f-8c3d-9e4f5a6b7c91", nome: "Aniversário", cor: "#007AFF" }
];

export const DEFAULT_PACOTES: Pacote[] = [
  {
    id: "018fded5-6b5c-7a2f-8c3d-9e4f5a6b7c92",
    nome: "Básico",
    categoria_id: "018fded5-6b5c-7a2f-8c3d-9e4f5a6b7c8f", 
    valor_base: 450,
    valor_foto_extra: 25,
    produtosIncluidos: []
  },
  {
    id: "018fded5-6b5c-7a2f-8c3d-9e4f5a6b7c93", 
    nome: "Completo",
    categoria_id: "018fded5-6b5c-7a2f-8c3d-9e4f5a6b7c8d",
    valor_base: 980,
    valor_foto_extra: 35,
    produtosIncluidos: [
      { produtoId: "018fded5-6b5c-7a2f-8c3d-9e4f5a6b7c94", quantidade: 1 }
    ]
  },
  {
    id: "018fded5-6b5c-7a2f-8c3d-9e4f5a6b7c95",
    nome: "Empresarial", 
    categoria_id: "018fded5-6b5c-7a2f-8c3d-9e4f5a6b7c90",
    valor_base: 890,
    valor_foto_extra: 30,
    produtosIncluidos: [
      { produtoId: "018fded5-6b5c-7a2f-8c3d-9e4f5a6b7c94", quantidade: 1 },
      { produtoId: "018fded5-6b5c-7a2f-8c3d-9e4f5a6b7c96", quantidade: 1 }
    ]
  }
];

export const DEFAULT_PRODUTOS: Produto[] = [
  {
    id: "018fded5-6b5c-7a2f-8c3d-9e4f5a6b7c94",
    nome: "Álbum 20x30",
    preco_custo: 180,
    preco_venda: 350
  },
  {
    id: "018fded5-6b5c-7a2f-8c3d-9e4f5a6b7c96",
    nome: "Quadro 30x40", 
    preco_custo: 120,
    preco_venda: 280
  }
];

export const DEFAULT_ETAPAS: EtapaTrabalho[] = [
  { id: "018fded5-6b5c-7a2f-8c3d-9e4f5a6b7c97", nome: "Fotografado", cor: "#00B2FF", ordem: 1 },
  { id: "018fded5-6b5c-7a2f-8c3d-9e4f5a6b7c98", nome: "Editando", cor: "#FF9500", ordem: 2 },
  { id: "018fded5-6b5c-7a2f-8c3d-9e4f5a6b7c99", nome: "Finalizado", cor: "#34C759", ordem: 3 }
];