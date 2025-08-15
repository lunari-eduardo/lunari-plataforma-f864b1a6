export type LeadStatus = string;

export interface LeadAction {
  tipo: 'whatsapp_simples' | 'pdf_enviado' | 'status_alterado';
  data: string;
  dadosExtras?: {
    pdfEnviado?: string;
    statusAnterior?: string;
    statusNovo?: string;
  };
}

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
  ultimaAcao?: LeadAction; // Histórico da última ação realizada
}

export interface LeadStatusDef {
  id: string;
  key: string; // valor salvo no lead
  name: string; // rótulo exibido
  order: number;
  isConverted?: boolean; // identifica status de convertido
  isLost?: boolean; // identifica status de perdido
}