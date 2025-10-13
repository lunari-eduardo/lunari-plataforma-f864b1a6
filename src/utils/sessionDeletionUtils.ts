import { supabase } from '@/integrations/supabase/client';

/**
 * Utilities for flexible session deletion with audit trail
 */

export interface DeletionOptions {
  includePayments: boolean;
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
  const { includePayments, userId } = options;

  try {
    if (includePayments) {
      // Delete payments first, then session
      const { error: paymentsError } = await supabase
        .from('clientes_transacoes')
        .delete()
        .eq('session_id', sessionId)
        .eq('user_id', userId);

      if (paymentsError) {
        console.error('❌ Error deleting payments:', paymentsError);
        throw new Error('Falha ao excluir pagamentos');
      }
      
      console.log('✅ Payments deleted for session:', sessionId);

      // Now delete the session
      const { error: sessionError } = await supabase
        .from('clientes_sessoes')
        .delete()
        .eq('session_id', sessionId)
        .eq('user_id', userId);

      if (sessionError) {
        console.error('❌ Error deleting session:', sessionError);
        throw new Error('Falha ao excluir sessão');
      }

      console.log('✅ Session deleted:', sessionId);
      
      return {
        success: true,
        deletedPayments: true,
        sessionId
      };
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