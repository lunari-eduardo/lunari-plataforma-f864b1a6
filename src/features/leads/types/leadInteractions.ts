export interface LeadInteraction {
  id: string;
  leadId: string;
  tipo: 'criacao' | 'mudanca_status' | 'conversa' | 'orcamento' | 'manual' | 'followup';
  descricao: string;
  timestamp: string;
  automatica: boolean;
  statusAnterior?: string;
  statusNovo?: string;
  detalhes?: string;
}

export interface FollowUpConfig {
  diasParaFollowUp: number;
  ativo: boolean;
  statusMonitorado: string; // Status que ativa o cronômetro (ex: "proposta_enviada")
}

export interface FollowUpNotification {
  id: string;
  leadId: string;
  leadNome: string;
  diasSemInteracao: number;
  timestamp: string;
  visualizada: boolean;
}