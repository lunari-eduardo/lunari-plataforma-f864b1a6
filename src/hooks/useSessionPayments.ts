import { useState, useCallback, useEffect } from 'react';
import { SessionPaymentExtended } from '@/types/sessionPayments';
import { SessionPayment } from '@/types/workflow';
import { formatDateForStorage } from '@/utils/dateUtils';

// Converter SessionPaymentExtended para SessionPayment (formato legado)
const convertToLegacyFormat = (extendedPayments: SessionPaymentExtended[]): SessionPayment[] => {
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
const savePaymentsToStorage = (sessionId: string, payments: SessionPaymentExtended[]) => {
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

export function useSessionPayments(sessionId: string, initialPayments: SessionPaymentExtended[] = []) {
  const [payments, setPayments] = useState<SessionPaymentExtended[]>(initialPayments);

  // Listener para eventos do AppContext (pagamentos rápidos)
  useEffect(() => {
    const handleWorkflowUpdate = () => {
      const sessions = JSON.parse(localStorage.getItem('workflow_sessions') || '[]');
      const currentSession = sessions.find((s: any) => s.id === sessionId);
      
      if (currentSession && currentSession.pagamentos) {
        // Converter pagamentos legados para formato estendido
        const extendedPayments: SessionPaymentExtended[] = currentSession.pagamentos.map((p: any) => {
          // Determinar tipo baseado em dados existentes
          let tipo = p.tipo || 'pago';
          let statusPagamento = p.statusPagamento || 'pago';
          
          // Se tem dataVencimento mas não tem data de pagamento, é agendado/pendente
          if (p.dataVencimento && !p.data) {
            tipo = 'agendado';
            statusPagamento = 'pendente';
          }
          
          // Se tem numeroParcela, é parcelado
          if (p.numeroParcela && p.totalParcelas) {
            tipo = 'parcelado';
            if (!p.data) {
              statusPagamento = 'pendente';
            }
          }
          
          console.log('💰 [useSessionPayments] Convertendo pagamento:', {
            id: p.id,
            originalTipo: p.tipo,
            originalStatus: p.statusPagamento,
            finalTipo: tipo,
            finalStatus: statusPagamento,
            data: p.data,
            dataVencimento: p.dataVencimento
          });
          
          return {
            id: p.id,
            valor: p.valor,
            data: p.data,
            tipo: tipo as 'pago' | 'agendado' | 'parcelado',
            statusPagamento: statusPagamento as 'pendente' | 'pago' | 'atrasado' | 'cancelado',
            origem: p.origem || 'manual',
            editavel: p.editavel !== false,
            forma_pagamento: p.forma_pagamento,
            observacoes: p.observacoes,
            dataVencimento: p.dataVencimento,
            numeroParcela: p.numeroParcela,
            totalParcelas: p.totalParcelas
          };
        });
        
        setPayments(extendedPayments);
      }
    };

    window.addEventListener('workflowSessionsUpdated', handleWorkflowUpdate);
    
    // Carregar dados iniciais
    handleWorkflowUpdate();

    return () => window.removeEventListener('workflowSessionsUpdated', handleWorkflowUpdate);
  }, [sessionId]);

  // Auto-save quando pagamentos mudarem
  useEffect(() => {
    if (payments.length > 0 || initialPayments.length > 0) {
      savePaymentsToStorage(sessionId, payments);
    }
  }, [payments, sessionId]);

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
    const dataVencimento = formatDateForStorage(dueDate);
    console.log('📅 [schedulePayment] Dados do agendamento:', {
      valor: value,
      dataOriginal: dueDate.toISOString(),
      dataFormatada: dataVencimento,
      observacoes
    });
    
    const newPayment: SessionPaymentExtended = {
      id: `scheduled-${Date.now()}`,
      valor: value,
      data: '', // Vazio pois ainda não foi pago
      dataVencimento: dataVencimento,
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
    schedulePayment,
    // Função para forçar sincronização manual se necessário
    syncToStorage: () => savePaymentsToStorage(sessionId, payments)
  };
}