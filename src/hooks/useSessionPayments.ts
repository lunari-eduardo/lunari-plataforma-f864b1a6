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

// Salvar UM ÚNICO pagamento específico no Supabase (evita loops de duplicação)
const saveSinglePaymentToSupabase = async (
  sessionId: string, 
  paymentId: string,
  payment: SessionPaymentExtended
) => {
  try {
    // Só salvar se o pagamento estiver pago e tiver data
    if (payment.statusPagamento !== 'pago' || !payment.data) {
      console.log('⏭️ Pagamento não está pago ou sem data, não salvando no Supabase:', paymentId);
      return;
    }

    const { PaymentSupabaseService } = await import('@/services/PaymentSupabaseService');
    
    // Usar método rastreado para evitar duplicação
    await PaymentSupabaseService.saveSinglePaymentTracked(sessionId, paymentId, {
      valor: payment.valor,
      data: payment.data,
      observacoes: payment.observacoes,
      forma_pagamento: payment.forma_pagamento
    });
    
    console.log('✅ Pagamento único sincronizado com Supabase:', paymentId);
  } catch (error) {
    console.error('❌ Erro ao salvar pagamento único no Supabase:', error);
  }
};

// Atualizar pagamento existente no Supabase (UPDATE em vez de INSERT)
const updatePaymentInSupabase = async (
  sessionId: string, 
  paymentId: string,
  payment: SessionPaymentExtended
) => {
  try {
    const { PaymentSupabaseService } = await import('@/services/PaymentSupabaseService');
    
    const success = await PaymentSupabaseService.updateSinglePayment(sessionId, paymentId, {
      valor: payment.valor,
      data: payment.data,
      observacoes: payment.observacoes,
      forma_pagamento: payment.forma_pagamento
    });
    
    if (success) {
      console.log('✅ Pagamento atualizado no Supabase:', paymentId);
    } else {
      console.error('❌ Falha ao atualizar pagamento no Supabase:', paymentId);
    }
  } catch (error) {
    console.error('❌ Erro ao atualizar pagamento no Supabase:', error);
  }
};

// Deletar pagamento do Supabase
const deletePaymentFromSupabase = async (sessionId: string, paymentId: string) => {
  try {
    const { PaymentSupabaseService } = await import('@/services/PaymentSupabaseService');
    await PaymentSupabaseService.deletePaymentFromSupabase(sessionId, paymentId);
    console.log('✅ Pagamento deletado do Supabase:', paymentId);
  } catch (error) {
    console.error('❌ Erro ao deletar pagamento do Supabase:', error);
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
  const [loadedFromSupabase, setLoadedFromSupabase] = useState(false);

  // NOVO: Buscar pagamentos UNIFICADOS do Supabase + Cobranças MP ao iniciar
  // E CRIAR TRANSAÇÕES AUTOMATICAMENTE para cobranças pagas sem transação
  useEffect(() => {
    const fetchUnifiedPayments = async () => {
      if (!sessionId || loadedFromSupabase) return;

      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // 1. Buscar session_id texto e cliente_id se sessionId for UUID
        let textSessionId = sessionId;
        let clienteId: string | null = null;
        
        const { data: sessaoData } = await supabase
          .from('clientes_sessoes')
          .select('session_id, cliente_id')
          .eq('id', sessionId)
          .maybeSingle();
        
        if (sessaoData?.session_id) {
          textSessionId = sessaoData.session_id;
          clienteId = sessaoData.cliente_id;
        } else {
          // Tentar buscar pelo session_id como texto
          const { data: sessaoTexto } = await supabase
            .from('clientes_sessoes')
            .select('session_id, cliente_id')
            .eq('session_id', sessionId)
            .maybeSingle();
          
          if (sessaoTexto) {
            textSessionId = sessaoTexto.session_id;
            clienteId = sessaoTexto.cliente_id;
          }
        }

        console.log('🔍 [useSessionPayments] Session IDs:', { sessionId, textSessionId, clienteId });

        // 2. Buscar transações por AMBOS os session_id (UUID e texto)
        const { data: transacoes, error: transError } = await supabase
          .from('clientes_transacoes')
          .select('*')
          .or(`session_id.eq.${sessionId},session_id.eq.${textSessionId}`)
          .eq('user_id', user.id)
          .order('data_transacao', { ascending: false });

        if (transError) {
          console.error('❌ [useSessionPayments] Erro ao buscar transações:', transError);
        }

        // 3. Buscar cobranças MP pagas para esta sessão
        const { data: cobrancasPagas, error: cobrancasError } = await supabase
          .from('cobrancas')
          .select('*')
          .or(`session_id.eq.${sessionId},session_id.eq.${textSessionId}`)
          .eq('user_id', user.id)
          .eq('status', 'pago')
          .order('data_pagamento', { ascending: false });

        if (cobrancasError) {
          console.error('❌ [useSessionPayments] Erro ao buscar cobranças:', cobrancasError);
        }

        const allPayments: SessionPaymentExtended[] = [];
        const addedIds = new Set<string>();
        const transacoesACriar: Array<{
          user_id: string;
          cliente_id: string;
          session_id: string;
          valor: number;
          data_transacao: string;
          tipo: string;
          descricao: string;
        }> = [];

        // 4. Converter transações para formato de pagamentos
        if (transacoes && transacoes.length > 0) {
          console.log('✅ [useSessionPayments] Transações do Supabase:', transacoes.length);

          for (const t of transacoes) {
            const match = t.descricao?.match(/\[ID:([^\]]+)\]/);
            const paymentId = match ? match[1] : t.id;
            
            if (addedIds.has(paymentId)) continue;
            addedIds.add(paymentId);

            const isPaid = t.tipo === 'pagamento';
            const isPending = t.tipo === 'ajuste';

            const parcelaMatch = t.descricao?.match(/Parcela (\d+)\/(\d+)/);
            const numeroParcela = parcelaMatch ? parseInt(parcelaMatch[1]) : undefined;
            const totalParcelas = parcelaMatch ? parseInt(parcelaMatch[2]) : undefined;

            let tipo: 'pago' | 'agendado' | 'parcelado' = 'pago';
            if (isPending) {
              tipo = totalParcelas ? 'parcelado' : 'agendado';
            }

            let statusPagamento: 'pendente' | 'pago' | 'atrasado' | 'cancelado' = 'pago';
            if (isPending) {
              statusPagamento = 'pendente';
              if (t.data_vencimento) {
                const hoje = new Date();
                const vencimento = new Date(t.data_vencimento);
                if (vencimento < hoje) statusPagamento = 'atrasado';
              }
            }

            // Detectar origem MP pela descrição
            const isMercadoPago = t.descricao?.toLowerCase().includes('mp #');
            
            allPayments.push({
              id: paymentId,
              valor: Number(t.valor) || 0,
              data: isPaid ? t.data_transacao : '',
              dataVencimento: t.data_vencimento || undefined,
              tipo,
              statusPagamento,
              numeroParcela,
              totalParcelas,
              origem: isMercadoPago ? 'mercadopago' : 'supabase',
              editavel: isPending,
              observacoes: t.descricao?.replace(/\s*\[ID:[^\]]+\]/, '') || ''
            });
          }
        }

        // 5. Processar cobranças MP pagas - CRIAR TRANSAÇÕES SE FALTAREM
        if (cobrancasPagas && cobrancasPagas.length > 0) {
          console.log('✅ [useSessionPayments] Cobranças MP pagas:', cobrancasPagas.length);

          for (const c of cobrancasPagas) {
            const paymentId = `mp-${c.mp_payment_id || c.id}`;
            
            if (addedIds.has(paymentId)) continue;
            
            // Verificar se já existe uma transação correspondente pela descrição
            const hasMatchingTransaction = transacoes?.some(t => 
              t.descricao?.includes(`MP #${c.mp_payment_id}`)
            );
            
            // Se NÃO tem transação correspondente, criar uma para sincronizar valor_pago
            if (!hasMatchingTransaction && clienteId && c.mp_payment_id) {
              const dataPagamento = c.data_pagamento 
                ? c.data_pagamento.split('T')[0] 
                : new Date().toISOString().split('T')[0];
              
              transacoesACriar.push({
                user_id: user.id,
                cliente_id: clienteId,
                session_id: textSessionId, // Usar session_id TEXTO
                valor: c.valor,
                data_transacao: dataPagamento,
                tipo: 'pagamento',
                descricao: `Pagamento via ${c.tipo_cobranca === 'pix' ? 'PIX' : 'LINK'} - MP #${c.mp_payment_id}`
              });
              
              console.log('🔄 [useSessionPayments] Transação a criar para cobrança MP:', c.mp_payment_id);
            }
            
            if (hasMatchingTransaction) continue;
            
            addedIds.add(paymentId);

            allPayments.push({
              id: paymentId,
              valor: Number(c.valor) || 0,
              data: c.data_pagamento ? c.data_pagamento.split('T')[0] : '',
              tipo: 'pago',
              statusPagamento: 'pago',
              origem: 'mercadopago',
              editavel: false,
              observacoes: `${c.tipo_cobranca === 'pix' ? 'Pix' : 'Link'} Mercado Pago${c.descricao ? ` - ${c.descricao}` : ''}`
            });
          }
        }

        // 6. CRIAR TRANSAÇÕES FALTANTES para atualizar valor_pago
        if (transacoesACriar.length > 0) {
          console.log('📝 [useSessionPayments] Criando', transacoesACriar.length, 'transações MP faltantes...');
          
          const { error: insertError } = await supabase
            .from('clientes_transacoes')
            .insert(transacoesACriar);
          
          if (insertError) {
            console.error('❌ [useSessionPayments] Erro ao criar transações MP:', insertError);
          } else {
            console.log('✅ [useSessionPayments] Transações MP criadas! Trigger irá atualizar valor_pago');
          }
        }

        if (allPayments.length > 0) {
          console.log('✅ [useSessionPayments] Total pagamentos unificados:', allPayments.length);
          setPayments(allPayments);
        }
        
        setLoadedFromSupabase(true);
      } catch (error) {
        console.error('❌ [useSessionPayments] Erro geral:', error);
        setLoadedFromSupabase(true);
      }
    };

    fetchUnifiedPayments();
  }, [sessionId, loadedFromSupabase]);

  // Listener para eventos do AppContext (pagamentos rápidos) - como fallback
  useEffect(() => {
    // Se já carregou do Supabase, não sobrescrever com localStorage
    if (loadedFromSupabase) return;

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
  }, [sessionId, loadedFromSupabase]);

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
      // Save to localStorage
      savePaymentsToStorage(sessionId, updated);
      // Save to Supabase only if paid
      if (newPayment.statusPagamento === 'pago' && newPayment.data) {
        saveSinglePaymentToSupabase(sessionId, newPayment.id, newPayment);
      }
      return updated;
    });
    
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
      
      // Save to localStorage
      savePaymentsToStorage(sessionId, updated);
      
      // Persistir no Supabase
      if (finalPayment.statusPagamento === 'pago' && finalPayment.data) {
        // UPDATE pagamento pago
        updatePaymentInSupabase(sessionId, paymentId, finalPayment);
      } else {
        // UPDATE pagamento pendente (agendado/parcelado)
        (async () => {
          const { PaymentSupabaseService } = await import('@/services/PaymentSupabaseService');
          await PaymentSupabaseService.updatePendingPayment(sessionId, paymentId, {
            valor: finalPayment.valor,
            dataVencimento: finalPayment.dataVencimento,
            observacoes: finalPayment.observacoes,
            numeroParcela: finalPayment.numeroParcela,
            totalParcelas: finalPayment.totalParcelas
          });
        })();
      }
      
      return updated;
    });
  }, [sessionId]);

  // Excluir pagamento
  const deletePayment = useCallback((paymentId: string) => {
    setPayments(prev => {
      const updated = prev.filter(p => p.id !== paymentId);
      // Save to localStorage
      savePaymentsToStorage(sessionId, updated);
      // Delete from Supabase (não re-salvar os restantes!)
      deletePaymentFromSupabase(sessionId, paymentId);
      return updated;
    });
  }, [sessionId]);

  // Marcar como pago (atualiza de pendente para pago no Supabase)
  const markAsPaid = useCallback(async (paymentId: string) => {
    const dataPagamento = formatDateForStorage(new Date());
    
    setPayments(prev => {
      const paidPayment = prev.find(p => p.id === paymentId);
      if (!paidPayment) return prev;
      
      const finalPayment = { 
        ...paidPayment, 
        statusPagamento: 'pago' as const,
        data: dataPagamento
      };
      
      const updated = prev.map(p => p.id === paymentId ? finalPayment : p);
      
      // Save to localStorage
      savePaymentsToStorage(sessionId, updated);
      
      // Atualizar no Supabase (de pendente para pago) com fallback
      (async () => {
        const { PaymentSupabaseService } = await import('@/services/PaymentSupabaseService');
        await PaymentSupabaseService.markPaymentAsPaid(
          sessionId, 
          paymentId, 
          dataPagamento,
          paidPayment.valor,
          paidPayment.observacoes
        );
      })();
      
      return updated;
    });
  }, [sessionId]);

  // Criar parcelas e salvar como pendentes no Supabase
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
      // Save to localStorage
      savePaymentsToStorage(sessionId, updated);
      
      // Salvar parcelas pendentes no Supabase
      (async () => {
        const { PaymentSupabaseService } = await import('@/services/PaymentSupabaseService');
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

  // Agendar pagamento único e salvar como pendente no Supabase
  const schedulePayment = useCallback(async (
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
      id: `scheduled-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
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
      // Save to localStorage
      savePaymentsToStorage(sessionId, updated);
      
      // Salvar agendamento pendente no Supabase
      (async () => {
        const { PaymentSupabaseService } = await import('@/services/PaymentSupabaseService');
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