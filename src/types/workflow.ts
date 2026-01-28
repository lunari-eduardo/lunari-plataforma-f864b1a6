import { RegrasPrecoFotoExtraCongeladas } from '@/contexts/AppContext';

export interface ProdutoWorkflow {
  nome: string;
  quantidade: number;
  valorUnitario: number;
  tipo: 'incluso' | 'manual';
  produzido?: boolean;
  entregue?: boolean;
}

export interface SessionPayment {
  id: string;
  valor: number;
  data: string;
  forma_pagamento?: string;
  observacoes?: string;
  // Novos campos para upgrade
  tipo: 'pago' | 'agendado' | 'parcelado';
  statusPagamento: 'pendente' | 'pago' | 'atrasado' | 'cancelado';
  dataVencimento?: string;
  numeroParcela?: number;
  totalParcelas?: number;
  origem: 'agenda' | 'workflow_rapido' | 'manual' | 'parcelado' | 'supabase' | 'mercadopago' | 'infinitepay';
  editavel: boolean;
}

export interface SessionData {
  id: string;
  data: string;
  hora: string;
  nome: string;
  email: string;
  descricao: string;
  status: string;
  whatsapp: string;
  categoria: string;
  pacote: string;
  valorPacote: string;
  valorFotoExtra: string;
  qtdFotosExtra: number;
  valorTotalFotoExtra: string;
  produto: string;
  qtdProduto: number;
  valorTotalProduto: string;
  valorAdicional: string;
  detalhes: string;
  observacoes: string;
  valor: string;
  total: string;
  valorPago: string;
  restante: string;
  desconto: string;
  pagamentos?: SessionPayment[];
  produtosList?: ProdutoWorkflow[];
  // Novos campos para orçamentos ajustados
  valorFinalAjustado?: boolean;
  valorOriginalOrcamento?: number;
  percentualAjusteOrcamento?: number;
  // Campo para regras congeladas
  regrasDePrecoFotoExtraCongeladas?: RegrasPrecoFotoExtraCongeladas;
  // Campo para dados de precificação congelados completos (Supabase)
  regras_congeladas?: any;
  // Campo para relacionar com cliente específico (CRM)
  clienteId?: string;
  // Campo session_id texto (formato workflow-*) para integração Gallery
  sessionId?: string;
  // Campos para integração com Galeria
  galeriaId?: string;
  galeriaStatus?: 'rascunho' | 'publicada' | 'em_selecao' | 'finalizada';
  galeriaStatusPagamento?: 'sem_vendas' | 'pendente' | 'pago';
}

export interface CategoryOption {
  id: string;
  nome: string;
}

export interface PackageOption {
  id: string;
  nome: string;
  valor: string;
  valorFotoExtra: string;
  categoria: string;
}

export interface ProductOption {
  id: string;
  nome: string;
  valor: string;
}