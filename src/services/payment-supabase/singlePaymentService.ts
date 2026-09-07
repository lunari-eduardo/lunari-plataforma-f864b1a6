import { supabase } from '@/integrations/supabase/client';
import { getSessionBinding, SessionBinding } from './sessionBinding';

/**
 * Verificar se um pagamento já existe no Supabase (por paymentId OU intentKey)
 */
export async function paymentExists(
  sessionKey: string,
  paymentId: string,
  options?: {
    binding?: SessionBinding;
    intentKey?: string;
  }
): Promise<boolean> {
  try {
    const sessao = options?.binding ?? await getSessionBinding(sessionKey);
    if (!sessao) return false;

    const filters: string[] = [`descricao.ilike.%[ID:${paymentId}]%`];
    if (options?.intentKey) {
      filters.push(`descricao.ilike.%[INTENT:${options.intentKey}]%`);
    }

    const { data, error } = await supabase
      .from('clientes_transacoes')
      .select('id')
      .eq('session_id', sessao.session_id)
      .or(filters.join(','))
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('❌ Erro ao verificar existência de pagamento:', error);
      return false;
    }

    return !!data;
  } catch (error) {
    console.error('❌ Erro ao verificar pagamento:', error);
    return false;
  }
}

/**
 * Salvar um único pagamento em clientes_transacoes
 */
export async function saveSinglePaymentToSupabase(
  sessionKey: string,
  payment: {
    valor: number;
    data: string;
    observacoes?: string;
    forma_pagamento?: string;
  }
): Promise<boolean> {
  try {
    const { data: userData, error: userError } = await supabase.auth.getUser();
    
    if (userError || !userData?.user) {
      console.error('❌ Usuário não autenticado:', userError);
      return false;
    }

    const userId = userData.user.id;
    const sessao = await getSessionBinding(sessionKey);
    
    if (!sessao) {
      console.error('❌ Sessão não encontrada para chave:', sessionKey);
      return false;
    }

    const { error: insertError } = await supabase
      .from('clientes_transacoes')
      .insert({
        user_id: userId,
        cliente_id: sessao.cliente_id,
        session_id: sessao.session_id,
        tipo: 'pagamento',
        valor: payment.valor,
        data_transacao: payment.data,
        descricao: payment.observacoes || 'Pagamento rápido',
        updated_by: userId
      });

    if (insertError) {
      console.error('❌ Erro ao inserir pagamento:', insertError);
      return false;
    }

    console.log('✅ Pagamento salvo no Supabase:', {
      sessionKey,
      session_id: sessao.session_id,
      valor: payment.valor,
      cliente_id: sessao.cliente_id
    });

    window.dispatchEvent(new CustomEvent('payment-created', {
      detail: { 
        sessionId: sessao.session_id, 
        amount: payment.valor,
        clienteId: sessao.cliente_id
      }
    }));

    return true;
  } catch (error) {
    console.error('❌ Erro ao salvar pagamento no Supabase:', error);
    return false;
  }
}

/**
 * Salvar um único pagamento específico (evita duplicação) com paymentId para rastreamento
 */
export async function saveSinglePaymentTracked(
  sessionKey: string,
  paymentId: string,
  payment: {
    valor: number;
    data: string;
    observacoes?: string;
    forma_pagamento?: string;
  },
  options?: {
    binding?: SessionBinding;
    intentKey?: string;
    cobrancaId?: string;
    dadosExtras?: Record<string, any>;
  }
): Promise<boolean> {
  try {
    const sessao = options?.binding ?? await getSessionBinding(sessionKey);
    if (!sessao) {
      console.error('❌ Sessão não encontrada para chave:', sessionKey);
      return false;
    }

    const exists = await paymentExists(sessionKey, paymentId, {
      binding: sessao,
      intentKey: options?.intentKey,
    });
    if (exists) {
      console.log('⚠️ Pagamento já existe (paymentId/intentKey), ignorando:', paymentId, options?.intentKey);
      return true;
    }

    if (options?.cobrancaId) {
      const { data: cobDup } = await supabase
        .from('clientes_transacoes')
        .select('id')
        .eq('cobranca_id', options.cobrancaId)
        .eq('tipo', 'pagamento')
        .limit(1)
        .maybeSingle();
      if (cobDup?.id) {
        console.log('⚠️ Já existe transação para esta cobranca_id, ignorando:', options.cobrancaId);
        return true;
      }
    }

    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    const userId = sessionData?.session?.user?.id;
    if (sessionError || !userId) {
      console.error('❌ Usuário não autenticado:', sessionError);
      return false;
    }

    const intentTag = options?.intentKey ? ` [INTENT:${options.intentKey}]` : '';
    const descricao = `${payment.observacoes || 'Pagamento'} [ID:${paymentId}]${intentTag}`;

    const { error: insertError } = await supabase
      .from('clientes_transacoes')
      .insert({
        user_id: userId,
        cliente_id: sessao.cliente_id,
        session_id: sessao.session_id,
        tipo: 'pagamento',
        valor: payment.valor,
        data_transacao: payment.data,
        descricao: descricao,
        cobranca_id: options?.cobrancaId ?? null,
        dados_extras: options?.dadosExtras ?? null,
        updated_by: userId
      });

    if (insertError) {
      if ((insertError as any).code === '23505') {
        console.log('⚠️ Transação já lançada por outra origem (unique_violation), ok:', options?.cobrancaId);
        return true;
      }
      console.error('❌ Erro ao inserir pagamento:', insertError);
      return false;
    }

    console.log('✅ Pagamento salvo:', { paymentId, session_id: sessao.session_id, valor: payment.valor });
    return true;
  } catch (error) {
    console.error('❌ Erro ao salvar pagamento rastreado:', error);
    return false;
  }
}

/**
 * Salvar múltiplos pagamentos (para modal de gerenciamento)
 */
export async function saveMultiplePayments(
  sessionKey: string,
  payments: Array<{
    valor: number;
    data: string;
    observacoes?: string;
    forma_pagamento?: string;
  }>
): Promise<boolean> {
  try {
    for (const payment of payments) {
      const success = await saveSinglePaymentToSupabase(sessionKey, payment);
      if (!success) {
        console.error('❌ Falha ao salvar pagamento:', payment);
        return false;
      }
    }
    return true;
  } catch (error) {
    console.error('❌ Erro ao salvar múltiplos pagamentos:', error);
    return false;
  }
}
