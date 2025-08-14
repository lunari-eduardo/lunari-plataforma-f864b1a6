/**
 * Tipos TypeScript para Sistema de Precificação
 * Estruturados para compatibilidade com Supabase multi-usuário
 */

// ============= TIPOS BASE =============

export interface GastoItem {
  id: string;
  user_id?: string; // Para compatibilidade multi-usuário
  descricao: string;
  valor: number;
  created_at?: string;
  updated_at?: string;
}

export interface Equipamento {
  id: string;
  user_id?: string; // Para compatibilidade multi-usuário
  nome: string;
  valorPago: number;
  dataCompra: string;
  vidaUtil: number;
  created_at?: string;
  updated_at?: string;
}

export interface ProdutoAdicional {
  id: string;
  user_id?: string; // Para compatibilidade multi-usuário
  nome: string;
  custo: number;
  valorVenda: number;
  quantidade: number;
  created_at?: string;
  updated_at?: string;
}

export interface CustoExtra {
  id: string;
  user_id?: string; // Para compatibilidade multi-usuário
  descricao: string;
  valorUnitario: number;
  quantidade: number;
  created_at?: string;
  updated_at?: string;
}

// ============= ESTRUTURAS DE DADOS PERSISTENTES =============

export interface EstruturaCustomerFixos {
  id?: string;
  user_id?: string;
  gastosPessoais: GastoItem[];
  percentualProLabore: number;
  custosEstudio: GastoItem[];
  equipamentos: Equipamento[];
  totalCalculado: number;
  created_at?: string;
  updated_at?: string;
}

export interface PadraoHoras {
  id?: string;
  user_id?: string;
  horasDisponiveis: number;
  diasTrabalhados: number;
  created_at?: string;
  updated_at?: string;
}

export interface MetasPrecificacao {
  id?: string;
  user_id?: string;
  margemLucroDesejada: number;
  ano: number;
  metaFaturamentoAnual: number;
  metaLucroAnual: number;
  created_at?: string;
  updated_at?: string;
}

export interface EstadoCalculadora {
  id?: string;
  user_id?: string;
  nome?: string; // Nome do cálculo para identificação
  horasEstimadas: number;
  markup: number;
  produtos: ProdutoAdicional[];
  custosExtras: CustoExtra[];
  custoTotalCalculado: number;
  precoFinalCalculado: number;
  lucratividade: number;
  salvo_automaticamente: boolean;
  created_at?: string;
  updated_at?: string;
}

// ============= TIPOS PARA VALIDAÇÃO =============

export interface DadosValidacao {
  estruturaCustos: boolean;
  padraoHoras: boolean;
  metas: boolean;
  calculadora: boolean;
  ultimaValidacao: string;
}

// ============= TIPOS PARA BACKUP/EXPORT =============

export interface BackupPrecificacao {
  versao: string;
  dataExport: string;
  user_id?: string;
  estruturaCustos: EstruturaCustomerFixos;
  padraoHoras: PadraoHoras;
  metas: MetasPrecificacao;
  estadosCalculadora: EstadoCalculadora[];
  configuracaoSistema: {
    versaoApp: string;
    chavesStorage: string[];
  };
}

// ============= TIPOS PARA MIGRAÇÃO =============

export interface MigracaoStatus {
  versaoAnterior: string;
  versaoAtual: string;
  dadosMigrados: boolean;
  datamigracao: string;
  erros: string[];
}

// ============= TIPOS UTILITÁRIOS =============

export type StatusSalvamento = 'salvando' | 'salvo' | 'erro' | 'nao_salvo';

export interface IndicadorSalvamento {
  status: StatusSalvamento;
  ultimoSalvamento?: string;
  proximoSalvamento?: string;
  mensagem?: string;
}