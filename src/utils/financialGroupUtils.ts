import { GrupoPrincipal } from '@/types/financas';
import { Receipt, CreditCard, TrendingUp, PiggyBank } from 'lucide-react';

/**
 * Utilitários para mapeamento e configuração de grupos financeiros
 * Centraliza toda a lógica de configuração visual e mapeamento
 */

export interface GrupoInfo {
  cor: string;
  corTema: string;
  icone: any;
  titulo: string;
  corStatus: string;
  corBorda: string;
}

export const GRUPOS_CONFIG: Record<GrupoPrincipal, GrupoInfo> = {
  'Despesa Fixa': {
    cor: 'red',
    corTema: 'text-destructive',
    icone: Receipt,
    titulo: 'Despesas Fixas',
    corStatus: 'bg-destructive/10 text-destructive border-destructive/20',
    corBorda: 'border-destructive/20'
  },
  'Despesa Variável': {
    cor: 'orange', 
    corTema: 'text-lunar-warning',
    icone: CreditCard,
    titulo: 'Despesas Variáveis',
    corStatus: 'bg-lunar-warning/10 text-lunar-warning border-lunar-warning/20',
    corBorda: 'border-lunar-warning/20'
  },
  'Investimento': {
    cor: 'purple',
    corTema: 'text-primary',
    icone: TrendingUp,
    titulo: 'Investimentos',
    corStatus: 'bg-primary/10 text-primary border-primary/20',
    corBorda: 'border-primary/20'
  },
  'Receita Não Operacional': {
    cor: 'green',
    corTema: 'text-lunar-success',
    icone: PiggyBank,
    titulo: 'Receitas Extras',
    corStatus: 'bg-lunar-success/10 text-lunar-success border-lunar-success/20',
    corBorda: 'border-lunar-success/20'
  },
  'Receita Operacional': {
    cor: 'emerald',
    corTema: 'text-emerald-600',
    icone: PiggyBank,
    titulo: 'Receitas Operacionais',
    corStatus: 'bg-emerald-50 text-emerald-600 border-emerald-200',
    corBorda: 'border-emerald-200'
  }
};

/**
 * Obtém informações de configuração para um grupo específico
 */
export function getInfoPorGrupo(grupo: GrupoPrincipal): GrupoInfo {
  return GRUPOS_CONFIG[grupo] || GRUPOS_CONFIG['Despesa Variável'];
}

/**
 * Mapeia tipos antigos para grupos da nova arquitetura
 */
export function mapearTipoParaGrupo(tipo: string): GrupoPrincipal {
  switch (tipo) {
    case 'fixas': return 'Despesa Fixa';
    case 'variaveis': return 'Despesa Variável';
    case 'receitas': return 'Receita Não Operacional';
    case 'investimentos': return 'Investimento';
    default: return 'Despesa Variável';
  }
}

/**
 * Lista ordenada dos grupos para renderização consistente
 */
export const GRUPOS_ORDEM: GrupoPrincipal[] = [
  'Receita Operacional',
  'Receita Não Operacional',
  'Despesa Fixa',
  'Despesa Variável', 
  'Investimento'
];

/**
 * Cores padronizadas para status de transações
 */
export const STATUS_COLORS = {
  Pago: 'bg-lunar-success/20 text-lunar-success',
  Faturado: 'bg-lunar-error/20 text-lunar-error',
  Agendado: 'bg-lunar-warning/20 text-lunar-warning'
} as const;