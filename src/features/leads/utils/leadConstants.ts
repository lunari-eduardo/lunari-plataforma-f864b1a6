import type { LeadStatusDef } from '../types/leads';

/**
 * Default lead statuses
 */
export const DEFAULT_LEAD_STATUSES: LeadStatusDef[] = [
  { id: '1', key: 'novo', name: 'Novo', order: 1, color: '#3b82f6' },
  { id: '2', key: 'contatado', name: 'Contatado', order: 2, color: '#8b5cf6' },
  { id: '3', key: 'interessado', name: 'Interessado', order: 3, color: '#06b6d4' },
  { id: '4', key: 'aguardando', name: 'Aguardando', order: 4, color: '#f59e0b' },
  { id: '5', key: 'negociacao', name: 'Em Negociação', order: 5, color: '#10b981' },
  { id: '6', key: 'proposta_aceita', name: 'Proposta Aceita', order: 6, color: '#22c55e' },
  { id: '7', key: 'convertido', name: 'Convertido', order: 7, color: '#16a34a', isConverted: true },
  { id: '8', key: 'perdido', name: 'Perdido', order: 8, color: '#dc2626', isLost: true }
];

/**
 * Lead origins
 */
export const DEFAULT_LEAD_ORIGINS = [
  'Instagram',
  'Facebook',
  'WhatsApp',
  'Indicação',
  'Site',
  'Google',
  'Outros'
];

/**
 * Follow-up configuration defaults
 */
export const DEFAULT_FOLLOWUP_CONFIG = {
  diasParaFollowUp: 3,
  ativo: true,
  statusMonitorado: 'aguardando'
};

/**
 * Lead interaction types
 */
export const INTERACTION_TYPES = {
  CRIACAO: 'criacao',
  MUDANCA_STATUS: 'mudanca_status',
  CONVERSA: 'conversa',
  ORCAMENTO: 'orcamento',
  MANUAL: 'manual',
  FOLLOWUP: 'followup'
} as const;

/**
 * Storage keys
 */
export const LEAD_STORAGE_KEYS = {
  LEADS: 'leads',
  LEAD_STATUSES: 'lead_statuses',
  FOLLOWUP_CONFIG: 'followup_config',
  LEAD_INTERACTIONS: 'lead_interactions'
} as const;