import type { LeadInteraction } from "./leadInteractions";

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
  dataAtualizacao?: string; // Timestamp da última atualização
  clienteId?: string; // Relacionamento com Cliente CRM
  interacoes: LeadInteraction[];
  ultimaInteracao?: string;
  diasSemInteracao?: number;
  needsFollowUp?: boolean;
  statusTimestamp?: string; // Timestamp da última mudança de status
  needsScheduling?: boolean; // Indica se precisa agendar
  scheduledAppointmentId?: string; // ID do agendamento criado
  motivoPerda?: string; // Motivo da perda do lead
  perdidoEm?: string; // Timestamp de quando foi perdido
  historicoStatus?: Array<{
    status: string;
    data: string; // ISO timestamp
    usuario?: string; // para futura auditoria
  }>;
}

export interface LeadStatusDef {
  id: string;
  key: string; // valor salvo no lead
  name: string; // rótulo exibido
  order: number;
  color?: string; // cor do status
  isConverted?: boolean; // identifica status de convertido
  isLost?: boolean; // identifica status de perdido
}
