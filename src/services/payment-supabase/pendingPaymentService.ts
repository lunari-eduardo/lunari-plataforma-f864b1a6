import { supabase } from '@/integrations/supabase/client';
import { getSessionBinding } from './sessionBinding';

/**
 * Atualiza um pagamento existente no Supabase com fallback para dados legados
 */
export async function updateSinglePayment(
  sessionKey: string,
  paymentId: string,
  payment: {
    valor?: number;
    data?: string;
    observacoes?: string;
    forma_pagamento?: string;
  }
): Promise<boolean> {
  try {
    console.log('🔄 [PaymentService] Updating payment:', { sessionKey, paymentId, payment });

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.error('❌ User not authenticated');
      return false;
    }

    const binding = await getSessionBinding(sessionKey);
    if (!binding) {
      console.error('❌ Session not found:', sessionKey);
      return false;
    }

    // 1) Tentar encontrar com [ID:paymentId]
    const { data: withTracking } = await supabase
      .from('clientes_transacoes')
      .select('id, valor, data_transacao, descricao')
      .eq('session_id', binding.session_id)
      .ilike('descricao', `%[ID:${paymentId}]%`)
      .maybeSingle();

    let transactionIdToUpdate: string | null = null;

    if (withTracking) {
      transactionIdToUpdate = withTracking.id;
      console.log('✅ Found payment with tracking:', transactionIdToUpdate);
    } else {
      console.log('⚠️ Payment not found with [ID:...], trying fallback');

      // Fallback 1: paymentId é UUID direto
      const isUuid = /^[0-9a-f-]{36}$/i.test(paymentId);
      if (isUuid) {
        const { data: byId } = await supabase
          .from('clientes_transacoes')
          .select('id, valor, data_transacao, descricao')
          .eq('id', paymentId)
          .eq('session_id', binding.session_id)
          .maybeSingle();
        if (byId) {
          transactionIdToUpdate = byId.id;
          console.log('✅ Found payment by UUID:', transactionIdToUpdate);
        }
      }

      // Fallback 2: pagamentos legados sem [ID:...]
      if (!transactionIdToUpdate) {
        const { data: legacy } = await supabase
          .from('clientes_transacoes')
          .select('id, descricao, valor, data_transacao')
          .eq('session_id', binding.session_id)
          .eq('cliente_id', binding.cliente_id)
          .eq('user_id', user.id)
          .eq('tipo', 'pagamento')
          .order('created_at', { ascending: true });

        const legacyPayment = legacy?.find(t => !t.descricao?.includes('[ID:'));
        if (legacyPayment) {
          transactionIdToUpdate = legacyPayment.id;
          console.log('✅ Found legacy payment without tracking:', transactionIdToUpdate);
        }
      }
    }

    if (!transactionIdToUpdate) {
      console.error('❌ Payment not found for update (neither with tracking nor legacy)');
      return false;
    }

    const updates: any = {
      updated_at: new Date().toISOString(),
      updated_by: user.id
    };

    if (payment.valor !== undefined) updates.valor = payment.valor;
    if (payment.data) updates.data_transacao = payment.data;
    
    const baseDesc = payment.observacoes || 'Pagamento';
    updates.descricao = `${baseDesc} [ID:${paymentId}]`;

    const { error } = await supabase
      .from('clientes_transacoes')
      .update(updates)
      .eq('id', transactionIdToUpdate);

    if (error) {
      console.error('❌ Error updating payment:', error);
      return false;
    }

    console.log('✅ Payment updated successfully with tracking added');
    return true;

  } catch (error) {
    console.error('❌ Error in updateSinglePayment:', error);
    return false;
  }
}

/**
 * Salvar pagamentos pendentes (parcelas/agendamentos) no Supabase
 */
export async function savePendingPayments(
  sessionKey: string,
  payments: Array<{
    paymentId: string;
    valor: number;
    dataVencimento: string;
    numeroParcela?: number;
    totalParcelas?: number;
    observacoes?: string;
    tipo: 'agendado' | 'parcelado';
  }>
): Promise<boolean> {
  try {
    console.log('💾 Salvando pagamentos pendentes:', { sessionKey, count: payments.length });

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.error('❌ User not authenticated');
      return false;
    }

    const binding = await getSessionBinding(sessionKey);
    if (!binding) {
      console.error('❌ Session not found:', sessionKey);
      return false;
    }

    const records = payments.map(p => {
      let descricao = p.observacoes || (p.tipo === 'parcelado' 
        ? `Parcela ${p.numeroParcela}/${p.totalParcelas}` 
        : 'Pagamento agendado');
      
      descricao = `${descricao} [ID:${p.paymentId}]`;

      return {
        user_id: user.id,
        cliente_id: binding.cliente_id,
        session_id: binding.session_id,
        tipo: 'ajuste',
        valor: p.valor,
        data_transacao: p.dataVencimento,
        data_vencimento: p.dataVencimento,
        descricao: descricao,
        updated_by: user.id
      };
    });

    const { error } = await supabase
      .from('clientes_transacoes')
      .insert(records);

    if (error) {
      console.error('❌ Error saving pending payments:', error);
      return false;
    }

    console.log(`✅ ${payments.length} pagamentos pendentes salvos no Supabase`);
    return true;

  } catch (error) {
    console.error('❌ Error in savePendingPayments:', error);
    return false;
  }
}

/**
 * Atualizar pagamento pendente (editar valores/vencimento sem marcar como pago)
 */
export async function updatePendingPayment(
  sessionKey: string,
  paymentId: string,
  updates: {
    valor?: number;
    dataVencimento?: string;
    observacoes?: string;
    numeroParcela?: number;
    totalParcelas?: number;
  }
): Promise<boolean> {
  try {
    console.log('📝 Atualizando pagamento pendente:', { sessionKey, paymentId, updates });

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.error('❌ User not authenticated');
      return false;
    }

    const binding = await getSessionBinding(sessionKey);
    if (!binding) {
      console.error('❌ Session not found:', sessionKey);
      return false;
    }

    const { data: existing } = await supabase
      .from('clientes_transacoes')
      .select('descricao')
      .eq('session_id', binding.session_id)
      .ilike('descricao', `%[ID:${paymentId}]%`)
      .maybeSingle();

    if (!existing) {
      console.error('❌ Pending payment not found:', paymentId);
      return false;
    }

    let descricao = existing.descricao;
    if (updates.observacoes !== undefined) {
      const idMatch = descricao.match(/\[ID:[^\]]+\]/);
      const idPart = idMatch ? idMatch[0] : `[ID:${paymentId}]`;
      
      if (updates.numeroParcela && updates.totalParcelas) {
        descricao = `Parcela ${updates.numeroParcela}/${updates.totalParcelas} ${idPart}`;
      } else {
        descricao = `${updates.observacoes || 'Pagamento agendado'} ${idPart}`;
      }
    }

    const updateData: any = {
      updated_at: new Date().toISOString(),
      updated_by: user.id,
      descricao
    };

    if (updates.valor !== undefined) updateData.valor = updates.valor;
    if (updates.dataVencimento) {
      updateData.data_vencimento = updates.dataVencimento;
      updateData.data_transacao = updates.dataVencimento;
    }

    const { error } = await supabase
      .from('clientes_transacoes')
      .update(updateData)
      .eq('session_id', binding.session_id)
      .ilike('descricao', `%[ID:${paymentId}]%`);

    if (error) {
      console.error('❌ Error updating pending payment:', error);
      return false;
    }

    console.log('✅ Pending payment updated successfully');
    return true;

  } catch (error) {
    console.error('❌ Error in updatePendingPayment:', error);
    return false;
  }
}

/**
 * Atualizar pagamento pendente para pago (marca como realizado)
 */
export async function markPaymentAsPaid(
  sessionKey: string,
  paymentId: string,
  dataPagamento: string,
  valor?: number,
  observacoes?: string
): Promise<boolean> {
  try {
    console.log('✅ Marcando pagamento como pago:', { sessionKey, paymentId, dataPagamento });

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.error('❌ User not authenticated');
      return false;
    }

    const binding = await getSessionBinding(sessionKey);
    if (!binding) {
      console.error('❌ Session not found:', sessionKey);
      return false;
    }

    // 1) Try marcador [ID:paymentId]
    let { data: updated, error } = await supabase
      .from('clientes_transacoes')
      .update({
        tipo: 'pagamento',
        data_transacao: dataPagamento,
        updated_at: new Date().toISOString(),
        updated_by: user.id
      })
      .eq('session_id', binding.session_id)
      .ilike('descricao', `%[ID:${paymentId}]%`)
      .select('id');

    if (error) {
      console.error('❌ Error marking payment as paid:', error);
      return false;
    }

    // 2) Fallback: paymentId pode ser o próprio UUID da transação
    const isUuid = /^[0-9a-f-]{36}$/i.test(paymentId);
    if ((!updated || updated.length === 0) && isUuid) {
      const retry = await supabase
        .from('clientes_transacoes')
        .update({
          tipo: 'pagamento',
          data_transacao: dataPagamento,
          updated_at: new Date().toISOString(),
          updated_by: user.id
        })
        .eq('id', paymentId)
        .eq('session_id', binding.session_id)
        .select('id');
      updated = retry.data ?? [];
      if (retry.error) {
        console.error('❌ Fallback by id also failed:', retry.error);
        return false;
      }
    }

    if (!updated || updated.length === 0) {
      console.error('❌ Pending payment not found for markAsPaid:', { sessionKey, paymentId });
      return false;
    }

    window.dispatchEvent(new CustomEvent('payment-created', {
      detail: { 
        sessionId: binding.session_id, 
        paymentId,
        clienteId: binding.cliente_id
      }
    }));

    console.log('✅ Payment marked as paid successfully');
    return true;

  } catch (error) {
    console.error('❌ Error in markPaymentAsPaid:', error);
    return false;
  }
}
