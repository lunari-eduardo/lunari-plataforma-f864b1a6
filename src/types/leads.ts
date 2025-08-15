import type { LeadInteraction } from './leadInteractions';

export type LeadStatus = string;

export interface Lead {
  id: string;
  nome: string;
  email: string;
  telefone: string;
  whatsapp?: string;
  origem?: string;
  status: LeadStatus;
  observacoes?: string;
  dataCriacao: string; // ISO string
  clienteId?: string; // Relacionamento com Cliente CRM
  orcamentoId?: string; // Se foi convertido em orçamento
  interacoes: LeadInteraction[];
  ultimaInteracao?: string;
  diasSemInteracao?: number;
  needsFollowUp?: boolean;
  statusTimestamp?: string; // Timestamp da última mudança de status
}

export interface LeadStatusDef {
  id: string;
  key: string; // valor salvo no lead
  name: string; // rótulo exibido
  order: number;
  isConverted?: boolean; // identifica status de convertido
  isLost?: boolean; // identifica status de perdido
}