import { useState, useCallback, useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { SessionPaymentExtended } from '@/types/sessionPayments';
import { formatDateForStorage } from '@/utils/dateUtils';
import { useAuthUser } from '@/shared/capability';

import { savePaymentsToStorage } from './session-payments/storageHelpers';
import {
  saveSinglePaymentToSupabase,
  updatePaymentInSupabase,
  deletePaymentFromSupabase,
  refundPaymentInSupabase,
} from './session-payments/supabasePaymentService';
import { executeGatewayRefund } from './session-payments/gatewayRefund';
import { fetchUnifiedSessionPayments } from './session-payments/fetchUnifiedPayments';

export function useSessionPayments(sessionId: string, initialPayments: SessionPaymentExtended[] = []) {
  const [payments, setPayments] = useState<SessionPaymentExtended[]>(initialPayments);
  const [loadedFromSupabase, setLoadedFromSupabase] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const queryClient = useQueryClient();
  const invalidateSessionQueries = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['workflow'] });
    queryClient.invalidateQueries({ queryKey: ['session-payments'] });
    queryClient.invalidateQueries({ queryKey: ['cliente-credito'] });
    queryClient.invalidateQueries({ queryKey: ['pending-sessions'] });
  }, [queryClient]);

  // Onda 4d hotfix — sem user a Capability retorna UNAUTHENTICATED.
  const capabilityUser = useAuthUser();
  const capabilityUserRef = useRef(capabilityUser);
  useEffect(() => { capabilityUserRef.current = capabilityUser; }, [capabilityUser]);
  
  // GUARD: Prevenir fetch múltiplo e loop infinito
  const fetchInitiatedRef = useRef(false);
  const lastSessionIdRef = useRef<string | null>(null);

  // Buscar pagamentos UNIFICADOS do Supabase + Cobranças ao iniciar
  useEffect(() => {
    const runFetch = async () => {
      if (!sessionId) return;
      if (sessionId === lastSessionIdRef.current && fetchInitiatedRef.current) return;
      
      fetchInitiatedRef.current = true;
      lastSessionIdRef.current = sessionId;
      setIsLoading(true);

      try {
        const unified = await fetchUnifiedSessionPayments(sessionId);
        if (unified.length > 0) {
          setPayments(unified);
        }
        setLoadedFromSupabase(true);
        setIsLoading(false);
      } catch (error) {
        console.error('❌ [useSessionPayments] Erro geral:', error);
        setLoadedFromSupabase(true);
        setIsLoading(false);
      }
    };

    runFetch();
  }, [sessionId, loadedFromSupabase]);

  // Listener para eventos do AppContext (pagamentos rápidos) - como fallback
  useEffect(() => {
    if (loadedFromSupabase) return;

    const handleWorkflowUpdate = () => {
      const sessions = JSON.parse(localStorage.getItem('workflow_sessions') || '[]');
      const currentSession = sessions.find((s: any) => s.id === sessionId);
      
      if (currentSession && currentSession.pagamentos) {
        const extendedPayments: SessionPaymentExtended[] = currentSession.pagamentos.map((p: any) => {
          let tipo = p.tipo;
          let statusPagamento = p.statusPagamento;
          
          if (!tipo || !statusPagamento) {
            if (p.numeroParcela && p.totalParcelas) {
              tipo = 'parcelado';
              statusPagamento = p.data ? 'pago' : 'pendente';
            } else if (p.dataVencimento && !p.data) {
              tipo = 'agendado';
              statusPagamento = 'pendente';
              const hoje = new Date();
              const vencimento = new Date(p.dataVencimento);
              if (vencimento < hoje) {
                statusPagamento = 'atrasado';
              }
            } else if (p.data) {
              tipo = 'pago';
              statusPagamento = 'pago';
            } else {
              tipo = 'agendado';
              statusPagamento = 'pendente';
            }
          }
          
          let finalidade: SessionPaymentExtended['finalidade'] = p.finalidade;
          const obs = (p.observacoes || '').toLowerCase();
          if (!finalidade) {
            if (tipo === 'estorno' || statusPagamento === 'estornado') finalidade = 'estorno';
            else if (p.origem === 'credito' || obs.includes('crédito do cliente')) finalidade = 'credito';
            else if (/(foto[s]?\s+extra|\[extras)/i.test(obs)) finalidade = 'fotos_extras';
            else if (/(sess[ãa]o\s*\+\s*extras|sessao_e_extras)/i.test(obs)) finalidade = 'sessao_e_extras';
            else if (/(sinal|entrada|arras|reserva)/i.test(obs)) finalidade = 'sinal';
            else if (/(venda\s+avulsa|avulso)/i.test(obs)) finalidade = 'avulso';
            else finalidade = 'sessao';
          }

          return {
            id: p.id,
            valor: p.valor,
            data: p.data,
            tipo: tipo as 'pago' | 'agendado' | 'parcelado',
            statusPagamento: statusPagamento as 'pendente' | 'pago' | 'atrasado' | 'cancelado',
            origem: p.origem || 'manual',
            finalidade,
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
    handleWorkflowUpdate();
    return () => window.removeEventListener('workflowSessionsUpdated', handleWorkflowUpdate);
  }, [sessionId, loadedFromSupabase]);

  // Totais calculados
  const totalEstornado = payments
    .filter(p => p.tipo === 'estorno')
    .reduce((acc, p) => acc + p.valor, 0);

  const totalPago = payments
    .filter(p => (p.tipo === 'pago' || p.tipo === 'parcelado') && (p.statusPagamento === 'pago' || p.statusPagamento === 'estornado'))
    .reduce((acc, p) => acc + p.valor, 0) - totalEstornado;

  const totalRecebido = payments
    .filter(p => (p.tipo === 'pago' || p.tipo === 'parcelado') && (p.statusPagamento === 'pago' || p.statusPagamento === 'estornado'))
    .reduce((acc, p) => acc + (p.valorLiquido != null ? p.valorLiquido : p.valor), 0) - totalEstornado;

  const totalTaxas = payments
    .filter(p => (p.tipo === 'pago' || p.tipo === 'parcelado') && (p.statusPagamento === 'pago' || p.statusPagamento === 'estornado'))
    .reduce((acc, p) => {
      const taxa = (p.taxaTotal || 0) + (p.taxaAntecipacao || 0);
      return acc + taxa;
    }, 0);

  const totalAgendado = payments
    .filter(p => p.statusPagamento === 'pendente' && p.dataVencimento)
    .reduce((acc, p) => acc + p.valor, 0);

  const totalPendente = payments
    .filter(p => p.statusPagamento === 'pendente' && !p.dataVencimento)
    .reduce((acc, p) => acc + p.valor, 0);

  // Adicionar novo pagamento
  const addPayment = useCallback(async (payment: Omit<SessionPaymentExtended, 'id'>) => {
    const newPayment: SessionPaymentExtended = {
      ...payment,
      id: `pay-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    };

    setPayments(prev => {
      const updated = [...prev, newPayment];
      savePaymentsToStorage(sessionId, updated);
      return updated;
    });

    if (newPayment.statusPagamento === 'pago' && newPayment.data) {
      try {
        const { USE_CAPABILITY_ADD_PAYMENT } = await import('@/features/workflow/config');
        if (USE_CAPABILITY_ADD_PAYMENT) {
          const { addPayment: addPaymentCapability } = await import('@/modules/workflow');
          const { isOk } = await import('@/shared/result');
          const result = await addPaymentCapability.execute(
            {
              sessionId,
              valor: Math.round((newPayment.valor || 0) * 100),
              dataTransacao: newPayment.data,
              formaPagamento: newPayment.forma_pagamento || 'manual',
              descricao: newPayment.observacoes || undefined,
              paymentId: newPayment.id,
              intentKey: `manual:${sessionId}:${newPayment.id}`,
            },
            { user: capabilityUserRef.current, runtime: 'client' }
          );
          if (!isOk(result)) {
            throw new Error(result.error.message);
          }
        } else {
          await saveSinglePaymentToSupabase(sessionId, newPayment.id, newPayment);
        }
      } catch (error) {
        console.error('❌ Erro ao salvar pagamento no Supabase:', error);
        const { toast } = await import('sonner');
        toast.error('Erro ao salvar pagamento. Tente novamente.');
      }
    }

    return newPayment;
  }, [sessionId]);

  // Editar pagamento existente
  const editPayment = useCallback((paymentId: string, updates: Partial<SessionPaymentExtended>) => {
    console.log('📝 [useSessionPayments] Editing payment:', { paymentId, updates });

    setPayments(prev => {
      const updatedPayment = prev.find(p => p.id === paymentId);
      if (!updatedPayment) return prev;

      const finalPayment = { ...updatedPayment, ...updates };
      const updated = prev.map(p => p.id === paymentId ? finalPayment : p);

      savePaymentsToStorage(sessionId, updated);

      (async () => {
        try {
          if (finalPayment.statusPagamento === 'pago' && finalPayment.data) {
            await updatePaymentInSupabase(sessionId, paymentId, finalPayment);
          } else {
            const { PaymentSupabaseService } = await (await import('@/utils/dynamicImport')).dynamicImport(() => import('@/services/PaymentSupabaseService'));
            await PaymentSupabaseService.updatePendingPayment(sessionId, paymentId, {
              valor: finalPayment.valor,
              dataVencimento: finalPayment.dataVencimento,
              observacoes: finalPayment.observacoes,
              numeroParcela: finalPayment.numeroParcela,
              totalParcelas: finalPayment.totalParcelas
            });
          }
          invalidateSessionQueries();
        } catch (err) {
          console.error('❌ editPayment persist error:', err);
        }
      })();

      return updated;
    });
  }, [sessionId, invalidateSessionQueries]);

  // Excluir pagamento
  const deletePayment = useCallback((paymentId: string) => {
    setPayments(prev => {
      const updated = prev.filter(p => p.id !== paymentId);
      savePaymentsToStorage(sessionId, updated);
      deletePaymentFromSupabase(sessionId, paymentId);
      window.dispatchEvent(new CustomEvent('payment-optimistic', {
        detail: { sessionId, sessionUuid: sessionId },
      }));
      window.dispatchEvent(new CustomEvent('payment-created', {
        detail: { sessionId, sessionUuid: sessionId },
      }));
      return updated;
    });
  }, [sessionId]);

  // Estornar pagamento
  const refundPayment = useCallback(async (
    paymentId: string,
    options?: { motivo?: string; autoRefund?: boolean; keepAsCredit?: boolean }
  ) => {
    const payment = payments.find(p => p.id === paymentId);
    if (!payment) return false;

    const motivo = options?.motivo;
    const keepAsCredit = options?.keepAsCredit === true;
    const autoRefund = !keepAsCredit && options?.autoRefund === true && payment.sandbox !== true;

    if (autoRefund && (payment.origem === 'asaas' || payment.origem === 'mercadopago')) {
      const successGw = await executeGatewayRefund(payment, paymentId, motivo);
      if (!successGw) return false;
    }

    const sufixos: string[] = [];
    if (autoRefund && (payment.origem === 'asaas' || payment.origem === 'mercadopago')) {
      sufixos.push('[Estornado no gateway]');
    }
    if (keepAsCredit) {
      sufixos.push('[Mantido como crédito]');
    }
    const motivoFinal = [motivo, ...sufixos].filter(Boolean).join(' ').trim() || undefined;

    const success = await refundPaymentInSupabase(sessionId, paymentId, payment.valor, motivoFinal, keepAsCredit);
    if (success) {
      const estorno: SessionPaymentExtended = {
        id: `refund-${Date.now()}`,
        valor: payment.valor,
        data: new Date().toISOString().split('T')[0],
        tipo: 'estorno',
        statusPagamento: 'estornado',
        origem: 'supabase',
        editavel: false,
        observacoes: `Estorno${motivoFinal ? `: ${motivoFinal}` : ''}`
      };
      setPayments(prev => prev.map(p => 
        p.id === paymentId ? { ...p, statusPagamento: 'estornado' as const } : p
      ).concat(estorno));

      window.dispatchEvent(new CustomEvent('payment-optimistic', {
        detail: { sessionId, sessionUuid: sessionId },
      }));
      window.dispatchEvent(new CustomEvent('payment-created', {
        detail: { sessionId, sessionUuid: sessionId },
      }));

      if (keepAsCredit) {
        const { toast } = await import('sonner');
        toast.success('Estorno registrado e valor mantido como crédito do cliente');
      }
    }
    return success;
  }, [sessionId, payments]);

  // Marcar como pago
  const markAsPaid = useCallback(async (paymentId: string) => {
    const dataPagamento = formatDateForStorage(new Date());
    const original = payments.find(p => p.id === paymentId);
    if (!original) return;

    const optimistic = payments.map(p =>
      p.id === paymentId ? { ...p, statusPagamento: 'pago' as const, data: dataPagamento } : p
    );
    setPayments(optimistic);
    savePaymentsToStorage(sessionId, optimistic);

    try {
      const { PaymentSupabaseService } = await (await import('@/utils/dynamicImport')).dynamicImport(() => import('@/services/PaymentSupabaseService'));
      const ok = await PaymentSupabaseService.markPaymentAsPaid(
        sessionId,
        paymentId,
        dataPagamento,
        original.valor,
        original.observacoes,
      );

      if (!ok) {
        setPayments(payments);
        savePaymentsToStorage(sessionId, payments);
        const { toast } = await import('sonner');
        toast.error('Não foi possível marcar como pago. Tente novamente.');
        return;
      }

      invalidateSessionQueries();
    } catch (err) {
      console.error('❌ markAsPaid falhou:', err);
      setPayments(payments);
      savePaymentsToStorage(sessionId, payments);
      const { toast } = await import('sonner');
      toast.error('Erro inesperado ao marcar pagamento como pago.');
    }
  }, [sessionId, payments, invalidateSessionQueries]);

  // Criar parcelas
  const createInstallments = useCallback(async (
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
        id: `installment-${Date.now()}-${i}-${Math.random().toString(36).substr(2, 5)}`,
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
      savePaymentsToStorage(sessionId, updated);
      
      (async () => {
        const { PaymentSupabaseService } = await (await import('@/utils/dynamicImport')).dynamicImport(() => import('@/services/PaymentSupabaseService'));
        await PaymentSupabaseService.savePendingPayments(
          sessionId,
          newInstallments.map(p => ({
            paymentId: p.id,
            valor: p.valor,
            dataVencimento: p.dataVencimento!,
            numeroParcela: p.numeroParcela,
            totalParcelas: p.totalParcelas,
            tipo: 'parcelado'
          }))
        );
      })();
      
      return updated;
    });
    
    return newInstallments;
  }, [sessionId]);

  // Agendar pagamento único
  const schedulePayment = useCallback(async (
    value: number,
    dueDate: Date,
    observacoes?: string
  ) => {
    const dataVencimento = formatDateForStorage(dueDate);
    const newPayment: SessionPaymentExtended = {
      id: `scheduled-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      valor: value,
      data: '',
      dataVencimento: dataVencimento,
      tipo: 'agendado',
      statusPagamento: 'pendente',
      origem: 'manual',
      editavel: true,
      observacoes
    };

    setPayments(prev => {
      const updated = [...prev, newPayment];
      savePaymentsToStorage(sessionId, updated);
      
      (async () => {
        const { PaymentSupabaseService } = await (await import('@/utils/dynamicImport')).dynamicImport(() => import('@/services/PaymentSupabaseService'));
        await PaymentSupabaseService.savePendingPayments(
          sessionId,
          [{
            paymentId: newPayment.id,
            valor: newPayment.valor,
            dataVencimento: newPayment.dataVencimento!,
            observacoes: newPayment.observacoes,
            tipo: 'agendado'
          }]
        );
      })();
      
      return updated;
    });
    
    return newPayment;
  }, [sessionId]);

  return {
    payments,
    totalPago,
    totalEstornado,
    totalRecebido,
    totalTaxas,
    totalAgendado,
    totalPendente,
    isLoading,
    setPayments,
    addPayment,
    editPayment,
    deletePayment,
    refundPayment,
    markAsPaid,
    createInstallments,
    schedulePayment,
    syncToStorage: () => savePaymentsToStorage(sessionId, payments)
  };
}