export interface SessionPaymentExtended {
  id: string;
  valor: number;
  data: string;
  dataVencimento?: string;
  createdAt?: string; // Timestamp completo para ordenação e exibição (YYYY-MM-DDTHH:MM:SS)
  tipo: 'pago' | 'agendado' | 'parcelado' | 'estorno';
  statusPagamento: 'pendente' | 'pago' | 'atrasado' | 'cancelado' | 'estornado';
  numeroParcela?: number;
  totalParcelas?: number;
  origem: 'agenda' | 'workflow_rapido' | 'manual' | 'parcelado' | 'supabase' | 'mercadopago' | 'infinitepay' | 'asaas' | 'credito';
  editavel: boolean;
  forma_pagamento?: string;
  observacoes?: string;
  valorLiquido?: number;
  taxaTotal?: number;
  dataCreditoPrevista?: string; // Data prevista de crédito na conta (D+32 cartão)
  dataCreditoReal?: string; // Data real de crédito (preenchida no PAYMENT_RECEIVED)
  statusRecebimento?: 'pendente' | 'confirmado' | 'recebido' | 'antecipado'; // Status do recebível
  taxaAntecipacao?: number;
}

export interface PaymentAction {
  type: 'add' | 'edit' | 'delete' | 'mark_paid' | 'refund';
  payment: Partial<SessionPaymentExtended>;
}

export interface RefundData {
  originalPaymentId: string;
  valor: number;
  motivo?: string;
}