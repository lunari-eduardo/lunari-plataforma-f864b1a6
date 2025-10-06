import { useState, useCallback, useEffect } from 'react';
import { SessionPaymentExtended } from '@/types/sessionPayments';
import { SessionPayment } from '@/types/workflow';
import { formatDateForStorage } from '@/utils/dateUtils';
import { supabase } from '@/integrations/supabase/client';

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

// Salvar pagamentos no Supabase e localStorage (dual-write para compatibilidade)
const savePaymentsToSupabase = async (sessionId: string, payments: SessionPaymentExtended[]) => {
  try {
    // Usar o serviço centralizado para salvar pagamentos
    const { PaymentSupabaseService } = await import('@/services/PaymentSupabaseService');
    
    // Filtrar apenas pagamentos pagos que têm data
    const paidPayments = payments.filter(p => p.statusPagamento === 'pago' && p.data);
    
    // Salvar cada pagamento usando o serviço
    for (const payment of paidPayments) {
      await PaymentSupabaseService.saveSinglePaymentToSupabase(sessionId, {
        valor: payment.valor,
        data: payment.data,
        observacoes: payment.observacoes,
        forma_pagamento: payment.forma_pagamento
      });
    }
    
    console.log('✅ Pagamentos sincronizados com Supabase via PaymentSupabaseService');
  } catch (error) {
    console.error('❌ Erro ao salvar pagamentos no Supabase:', error);
  }
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
          // Determinar tipo e status com lógica mais robusta
          let tipo = p.tipo;
          let statusPagamento = p.statusPagamento;
          
          // Se tipo/status já existem e são válidos, confiar neles
          if (!tipo || !statusPagamento) {
            // Inferir baseado em dados disponíveis
            if (p.numeroParcela && p.totalParcelas) {
              tipo = 'parcelado';
              statusPagamento = p.data ? 'pago' : 'pendente';
            } else if (p.dataVencimento && !p.data) {
              tipo = 'agendado';
              statusPagamento = 'pendente';
              
              // Verificar se está atrasado
              const hoje = new Date();
              const vencimento = new Date(p.dataVencimento);
              if (vencimento < hoje) {
                statusPagamento = 'atrasado';
              }
            } else if (p.data) {
              tipo = 'pago';
              statusPagamento = 'pago';
            } else {
              // Fallback: se não tem data nem vencimento, assumir pendente
              tipo = 'agendado';
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

  // Remove auto-save useEffect to prevent loops
  // Payments will be saved explicitly in each action function

  // Calcular total pago (apenas pagamentos com status 'pago')
  const totalPago = payments
    .filter(p => p.statusPagamento === 'pago')
    .reduce((acc, p) => acc + p.valor, 0);

  // Calcular total agendado (com data de vencimento definida)
  const totalAgendado = payments
    .filter(p => p.statusPagamento === 'pendente' && p.dataVencimento)
    .reduce((acc, p) => acc + p.valor, 0);

  // Calcular total pendente (sem data de vencimento específica)
  const totalPendente = payments
    .filter(p => p.statusPagamento === 'pendente' && !p.dataVencimento)
    .reduce((acc, p) => acc + p.valor, 0);

  // Adicionar novo pagamento
  const addPayment = useCallback((payment: Omit<SessionPaymentExtended, 'id'>) => {
    const newPayment: SessionPaymentExtended = {
      ...payment,
      id: `pay-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    };
    
    setPayments(prev => {
      const updated = [...prev, newPayment];
      // Save explicitly
      savePaymentsToStorage(sessionId, updated);
      savePaymentsToSupabase(sessionId, updated);
      return updated;
    });
    
    return newPayment;
  }, [sessionId]);

  // Editar pagamento existente
  const editPayment = useCallback((paymentId: string, updates: Partial<SessionPaymentExtended>) => {
    setPayments(prev => {
      const updated = prev.map(p => p.id === paymentId ? { ...p, ...updates } : p);
      // Save explicitly
      savePaymentsToStorage(sessionId, updated);
      savePaymentsToSupabase(sessionId, updated);
      return updated;
    });
  }, [sessionId]);

  // Excluir pagamento
  const deletePayment = useCallback((paymentId: string) => {
    setPayments(prev => {
      const updated = prev.filter(p => p.id !== paymentId);
      // Save explicitly
      savePaymentsToStorage(sessionId, updated);
      savePaymentsToSupabase(sessionId, updated);
      return updated;
    });
  }, [sessionId]);

  // Marcar como pago
  const markAsPaid = useCallback((paymentId: string) => {
    setPayments(prev => {
      const updated = prev.map(p => 
        p.id === paymentId 
          ? { 
              ...p, 
              statusPagamento: 'pago' as const,
              data: formatDateForStorage(new Date())
            }
          : p
      );
      // Save explicitly
      savePaymentsToStorage(sessionId, updated);
      savePaymentsToSupabase(sessionId, updated);
      return updated;
    });
  }, [sessionId]);

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

    setPayments(prev => {
      const updated = [...prev, ...newInstallments];
      // Save explicitly
      savePaymentsToStorage(sessionId, updated);
      savePaymentsToSupabase(sessionId, updated);
      return updated;
    });
    
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

    setPayments(prev => {
      const updated = [...prev, newPayment];
      // Save explicitly
      savePaymentsToStorage(sessionId, updated);
      savePaymentsToSupabase(sessionId, updated);
      return updated;
    });
    
    return newPayment;
  }, []);

  return {
    payments,
    totalPago,
    totalAgendado,
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