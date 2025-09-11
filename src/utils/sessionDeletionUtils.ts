import { supabase } from '@/integrations/supabase/client';

/**
 * Utilities for flexible session deletion with audit trail
 */

export interface DeletionOptions {
  includePayments: boolean;
  userId: string;
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
    // Step 1: Delete payments if requested
    if (includePayments) {
      const { error: paymentsError } = await supabase
        .from('clientes_transacoes')
        .delete()
        .eq('session_id', sessionId)
        .eq('user_id', userId);

      if (paymentsError) {
        console.error('Error deleting payments:', paymentsError);
        throw paymentsError;
      }
      
      console.log('✅ Payments deleted for session:', sessionId);
    }

    // Step 2: Delete the session
    // This will set session_id to NULL in remaining payments due to ON DELETE SET NULL
    const { error: sessionError } = await supabase
      .from('clientes_sessoes')
      .delete()
      .eq('session_id', sessionId)
      .eq('user_id', userId);

    if (sessionError) {
      console.error('Error deleting session:', sessionError);
      throw sessionError;
    }

    console.log('✅ Session deleted:', sessionId);
    
    return {
      success: true,
      deletedPayments: includePayments,
      sessionId
    };

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