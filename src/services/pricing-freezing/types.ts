/**
 * Tipos e interfaces do serviço de congelamento de precificação
 */

export interface PacoteCongelado {
  id: string;
  nome: string;
  valorBase: number;
  valorFotoExtra: number;
  fotosIncluidas?: number;
  categoria: string;
  categoriaId?: string;
  produtosIncluidos?: any[];
}

export interface ProdutoCongelado {
  id: string;
  produtoId?: string;
  nome: string;
  valorUnitario: number;
  quantidade: number;
  tipo: 'incluso' | 'manual';
  fluxo?: 'padrao' | 'custom';
  produzido?: boolean;
  entregue?: boolean;
  etapas?: Array<{ id: string; nome: string; done: boolean }>;
  prazoEntrega?: string;
  started?: boolean;
  startedAt?: string;
}

export interface PrecificacaoFotoExtra {
  modelo: 'fixo' | 'global' | 'categoria';
  valorFixo?: number;
  tabelaGlobal?: any;
  tabelaCategoria?: any;
}

export interface RegrasCongeladas extends Record<string, any> {
  modelo: 'completo';
  dataCongelamento: string;
  pacote?: PacoteCongelado;
  produtos?: ProdutoCongelado[];
  precificacaoFotoExtra: PrecificacaoFotoExtra;
}

export interface IntegridadeIssue {
  sessionId: string;
  issue: string;
  severity: 'warning' | 'info' | 'error';
}
