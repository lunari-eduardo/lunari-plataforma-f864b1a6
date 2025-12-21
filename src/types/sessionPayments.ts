export interface SessionPaymentExtended {
  id: string;
  valor: number;
  data: string;
  dataVencimento?: string;
  tipo: 'pago' | 'agendado' | 'parcelado';
  statusPagamento: 'pendente' | 'pago' | 'atrasado' | 'cancelado';
  numeroParcela?: number;
  totalParcelas?: number;
  origem: 'agenda' | 'workflow_rapido' | 'manual' | 'parcelado' | 'supabase' | 'mercadopago';
  editavel: boolean;
  forma_pagamento?: string;
  observacoes?: string;
}

export interface PaymentAction {
  type: 'add' | 'edit' | 'delete' | 'mark_paid';
  payment: Partial<SessionPaymentExtended>;
}