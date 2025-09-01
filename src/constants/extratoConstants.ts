/**
 * Constantes para o sistema de extrato financeiro
 */

import { ExtratoTipo, ExtratoOrigem, ExtratoStatus } from '@/types/extrato';

// ============= CONFIGURAÇÕES GERAIS =============
export const PREFERENCIAS_STORAGE_KEY = 'lunari_extrato_preferencias';

// ============= CORES E BADGES =============
export const ORIGEM_COLORS = {
  workflow: 'bg-blue-500/10 text-blue-700 border-blue-200',
  financeiro: 'bg-purple-500/10 text-purple-700 border-purple-200',
  cartao: 'bg-orange-500/10 text-orange-700 border-orange-200'
} as const;

export const STATUS_COLORS = {
  Pago: 'bg-green-500/10 text-green-700 border-green-200',
  Faturado: 'bg-yellow-500/10 text-yellow-700 border-yellow-200',
  Agendado: 'bg-gray-500/10 text-gray-700 border-gray-200'
} as const;

export const TIPO_COLORS = {
  entrada: 'text-green-600',
  saida: 'text-red-600'
} as const;

// ============= MAPEAMENTOS =============
export const ORIGEM_LABELS = {
  workflow: 'Workflow',
  financeiro: 'Financeiro',
  cartao: 'Cartão'
} as const;

export const TIPO_LABELS = {
  entrada: 'Entrada',
  saida: 'Saída'
} as const;

// ============= GRUPOS DE DESPESAS =============
export const GRUPOS_DESPESAS = ['Despesa Fixa', 'Despesa Variável', 'Investimento'] as const;

// ============= COLUNAS DISPONÍVEIS =============
export const COLUNAS_DISPONIVEIS = [
  'data',
  'tipo', 
  'descricao',
  'origem',
  'categoria',
  'parcela',
  'valor',
  'status',
  'saldo'
] as const;

// ============= FILTROS PADRÃO =============
export const FILTROS_DEFAULT = {
  tipo: 'todos' as ExtratoTipo | 'todos',
  origem: 'todos' as ExtratoOrigem | 'todos',
  status: 'todos' as ExtratoStatus | 'todos'
} as const;

// ============= PREFERÊNCIAS PADRÃO =============
export const PREFERENCIAS_DEFAULT = {
  filtrosDefault: FILTROS_DEFAULT,
  colunasSelecionadas: ['data', 'tipo', 'descricao', 'origem', 'categoria', 'valor', 'status'] as string[],
  ordenacao: {
    campo: 'data',
    direcao: 'desc' as 'desc'
  }
};