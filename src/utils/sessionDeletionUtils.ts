import { supabase } from '@/integrations/supabase/client';

/**
 * Utilities for flexible session deletion with audit trail
 */

export interface DeletionOptions {
  paymentAction: 'preserve' | 'refund';
  userId: string;
}

/**
 * Orphan payments and then delete session
 * Used when preserving payment history
 */
export async function orphanPaymentsThenDeleteSession(
  userId: string,
  sessionId: string
) {
  try {
    // Step 1: Orphan payments by setting session_id to NULL
    const { error: updateError, count } = await supabase
      .from('clientes_transacoes')
      .update({ 
        session_id: null, 
        updated_at: new Date().toISOString(),
        updated_by: userId 
      })
      .eq('session_id', sessionId)
      .eq('user_id', userId);

    if (updateError) {
      console.error('❌ Error orphaning payments:', updateError);
      throw new Error('Falha ao desvincular pagamentos da sessão');
    }

    console.log(`✅ ${count || 0} payment(s) orphaned for session:`, sessionId);

    // Step 2: Delete the session
    const { error: sessionError } = await supabase
      .from('clientes_sessoes')
      .delete()
      .eq('session_id', sessionId)
      .eq('user_id', userId);

    if (sessionError) {
      console.error('❌ Error deleting session:', sessionError);
      throw new Error('Falha ao excluir sessão do workflow');
    }

    console.log('✅ Session deleted, payments preserved as orphans:', sessionId);
    
    return {
      success: true,
      orphanedPayments: count || 0,
      sessionId
    };

  } catch (error) {
    console.error('❌ Error in orphan+delete operation:', error);
    throw error;
  }
}

/**
 * Delete session with flexible options for payments
 */
export async function deleteSessionWithOptions(
  sessionId: string,
  options: DeletionOptions
) {
  const { paymentAction, userId } = options;

  try {
    if (paymentAction === 'refund') {
      // Buscar pagamentos pagos da sessão para estornar
      const { data: paidPayments, error: fetchError } = await supabase
        .from('clientes_transacoes')
        .select('id, valor, descricao')
        .eq('session_id', sessionId)
        .eq('user_id', userId)
        .eq('tipo', 'pagamento');

      if (fetchError) {
        console.error('❌ Error fetching payments for refund:', fetchError);
        throw new Error('Falha ao buscar pagamentos para estorno');
      }

      // Criar estorno para cada pagamento pago
      if (paidPayments && paidPayments.length > 0) {
        const refundRecords = paidPayments.map(p => ({
          user_id: userId,
          cliente_id: '', // Will be resolved below
          session_id: sessionId,
          tipo: 'estorno',
          valor: Number(p.valor),
          data_transacao: new Date().toISOString().split('T')[0],
          descricao: `Estorno por exclusão de sessão`,
          updated_by: userId
        }));

        // Get cliente_id from session
        const { data: sessaoData } = await supabase
          .from('clientes_sessoes')
          .select('cliente_id')
          .eq('session_id', sessionId)
          .maybeSingle();

        if (sessaoData?.cliente_id) {
          refundRecords.forEach(r => r.cliente_id = sessaoData.cliente_id);
        }

        const { error: refundError } = await supabase
          .from('clientes_transacoes')
          .insert(refundRecords);

        if (refundError) {
          console.error('❌ Error creating refunds:', refundError);
          throw new Error('Falha ao criar estornos');
        }

        console.log(`✅ ${paidPayments.length} estorno(s) criado(s) para sessão:`, sessionId);
      }

      // Orphan payments then delete session
      return await orphanPaymentsThenDeleteSession(userId, sessionId);
    } else {
      // Preserve payments by orphaning them first
      return await orphanPaymentsThenDeleteSession(userId, sessionId);
    }

  } catch (error) {
    console.error('❌ Error in flexible deletion:', error);
    throw error;
  }
}

/**
 * Get orphaned payments (payments without session_id)
 */
export async function getOrphanedPayments(userId: string) {
  try {
    const { data, error } = await supabase
      .from('clientes_transacoes')
      .select(`
        *,
        clientes (nome)
      `)
      .eq('user_id', userId)
      .is('session_id', null);

    if (error) throw error;

    return data || [];
  } catch (error) {
    console.error('❌ Error getting orphaned payments:', error);
    throw error;
  }
}

/**
 * Clean up orphaned payments older than specified days
 */
export async function cleanupOrphanedPayments(
  userId: string, 
  olderThanDays: number = 30
) {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    const { error } = await supabase
      .from('clientes_transacoes')
      .delete()
      .eq('user_id', userId)
      .is('session_id', null)
      .lt('created_at', cutoffDate.toISOString());

    if (error) throw error;

    console.log(`✅ Orphaned payments older than ${olderThanDays} days cleaned up`);
  } catch (error) {
    console.error('❌ Error cleaning up orphaned payments:', error);
    throw error;
  }
}