import { useState, useCallback } from 'react';
import { SessionPaymentExtended } from '@/types/sessionPayments';
import { formatDateForStorage } from '@/utils/dateUtils';

export function useSessionPayments(sessionId: string, initialPayments: SessionPaymentExtended[] = []) {
  const [payments, setPayments] = useState<SessionPaymentExtended[]>(initialPayments);

  // Calcular total pago (apenas pagamentos com status 'pago')
  const totalPago = payments
    .filter(p => p.statusPagamento === 'pago')
    .reduce((acc, p) => acc + p.valor, 0);

  // Calcular total agendado/pendente
  const totalPendente = payments
    .filter(p => p.statusPagamento === 'pendente')
    .reduce((acc, p) => acc + p.valor, 0);

  // Adicionar novo pagamento
  const addPayment = useCallback((payment: Omit<SessionPaymentExtended, 'id'>) => {
    const newPayment: SessionPaymentExtended = {
      ...payment,
      id: `pay-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    };
    
    setPayments(prev => [...prev, newPayment]);
    return newPayment;
  }, []);

  // Editar pagamento existente
  const editPayment = useCallback((paymentId: string, updates: Partial<SessionPaymentExtended>) => {
    setPayments(prev => 
      prev.map(p => p.id === paymentId ? { ...p, ...updates } : p)
    );
  }, []);

  // Excluir pagamento
  const deletePayment = useCallback((paymentId: string) => {
    setPayments(prev => prev.filter(p => p.id !== paymentId));
  }, []);

  // Marcar como pago
  const markAsPaid = useCallback((paymentId: string) => {
    setPayments(prev => 
      prev.map(p => 
        p.id === paymentId 
          ? { 
              ...p, 
              statusPagamento: 'pago' as const,
              data: formatDateForStorage(new Date())
            }
          : p
      )
    );
  }, []);

  // Criar parcelas
  const createInstallments = useCallback((
    totalValue: number, 
    installmentCount: number, 
    startDate: Date,
    intervalDays: number = 30
  ) => {
    const installmentValue = totalValue / installmentCount;
    const newInstallments: SessionPaymentExtended[] = [];

    for (let i = 0; i < installmentCount; i++) {
      const dueDate = new Date(startDate);
      dueDate.setDate(dueDate.getDate() + (i * intervalDays));

      newInstallments.push({
        id: `installment-${Date.now()}-${i}`,
        valor: installmentValue,
        data: '',
        dataVencimento: formatDateForStorage(dueDate),
        tipo: 'parcelado',
        statusPagamento: 'pendente',
        numeroParcela: i + 1,
        totalParcelas: installmentCount,
        origem: 'parcelado',
        editavel: true
      });
    }

    setPayments(prev => [...prev, ...newInstallments]);
    return newInstallments;
  }, []);

  // Agendar pagamento único
  const schedulePayment = useCallback((
    value: number,
    dueDate: Date,
    observacoes?: string
  ) => {
    const newPayment: SessionPaymentExtended = {
      id: `scheduled-${Date.now()}`,
      valor: value,
      data: '',
      dataVencimento: formatDateForStorage(dueDate),
      tipo: 'agendado',
      statusPagamento: 'pendente',
      origem: 'manual',
      editavel: true,
      observacoes
    };

    setPayments(prev => [...prev, newPayment]);
    return newPayment;
  }, []);

  return {
    payments,
    totalPago,
    totalPendente,
    setPayments,
    addPayment,
    editPayment,
    deletePayment,
    markAsPaid,
    createInstallments,
    schedulePayment
  };
}