import { SessionPaymentExtended } from '@/types/sessionPayments';

// Salvar UM ÚNICO pagamento específico no Supabase (evita loops de duplicação)
export const saveSinglePaymentToSupabase = async (
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

    const { PaymentSupabaseService } = await (await import('@/utils/dynamicImport')).dynamicImport(() => import('@/services/PaymentSupabaseService'));
    
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
export const updatePaymentInSupabase = async (
  sessionId: string, 
  paymentId: string,
  payment: SessionPaymentExtended
) => {
  try {
    const { PaymentSupabaseService } = await (await import('@/utils/dynamicImport')).dynamicImport(() => import('@/services/PaymentSupabaseService'));
    
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

// Deletar pagamento do Supabase (apenas para pendentes)
export const deletePaymentFromSupabase = async (sessionId: string, paymentId: string) => {
  try {
    const { PaymentSupabaseService } = await (await import('@/utils/dynamicImport')).dynamicImport(() => import('@/services/PaymentSupabaseService'));
    await PaymentSupabaseService.deletePaymentFromSupabase(sessionId, paymentId);
    console.log('✅ Pagamento deletado do Supabase:', paymentId);
  } catch (error) {
    console.error('❌ Erro ao deletar pagamento do Supabase:', error);
  }
};

// Estornar pagamento no Supabase (para pagos)
export const refundPaymentInSupabase = async (
  sessionId: string,
  paymentId: string,
  valor: number,
  motivo?: string,
  keepAsCredit?: boolean,
) => {
  try {
    const { PaymentSupabaseService } = await (await import('@/utils/dynamicImport')).dynamicImport(() => import('@/services/PaymentSupabaseService'));
    const success = await PaymentSupabaseService.refundPayment(sessionId, paymentId, valor, motivo, { keepAsCredit });
    if (success) {
      console.log('✅ Pagamento estornado no Supabase:', paymentId, { keepAsCredit });
    }
    return success;
  } catch (error) {
    console.error('❌ Erro ao estornar pagamento no Supabase:', error);
    return false;
  }
};
