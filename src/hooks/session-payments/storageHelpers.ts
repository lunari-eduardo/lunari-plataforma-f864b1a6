import { SessionPaymentExtended } from '@/types/sessionPayments';
import { SessionPayment } from '@/types/workflow';

// Converter SessionPaymentExtended para SessionPayment (formato legado)
export const convertToLegacyFormat = (extendedPayments: SessionPaymentExtended[]): SessionPayment[] => {
  return extendedPayments.map(p => ({
    id: p.id,
    valor: p.valor,
    data: p.data,
    forma_pagamento: p.forma_pagamento,
    observacoes: p.observacoes,
    tipo: p.tipo,
    statusPagamento: p.statusPagamento,
    dataVencimento: p.dataVencimento,
    numeroParcela: p.numeroParcela,
    totalParcelas: p.totalParcelas,
    origem: p.origem,
    editavel: p.editavel
  }));
};

// Salvar pagamentos no localStorage
export const savePaymentsToStorage = (sessionId: string, payments: SessionPaymentExtended[]) => {
  const sessions = JSON.parse(localStorage.getItem('workflow_sessions') || '[]');
  const updatedSessions = sessions.map((s: any) => 
    s.id === sessionId ? { 
      ...s, 
      pagamentos: convertToLegacyFormat(payments),
      valorPago: payments.filter(p => p.statusPagamento === 'pago').reduce((acc, p) => acc + p.valor, 0)
    } : s
  );
  localStorage.setItem('workflow_sessions', JSON.stringify(updatedSessions));
  
  // Disparar evento para sincronização global
  window.dispatchEvent(new CustomEvent('workflowSessionsUpdated'));
};
