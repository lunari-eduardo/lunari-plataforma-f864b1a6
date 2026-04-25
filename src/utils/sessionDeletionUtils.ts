import { supabase } from '@/integrations/supabase/client';

/**
 * @deprecated Use `supabase.rpc('delete_workflow_session_cascade', { p_session_pk, p_action })` directly.
 * This module is kept only as a compatibility shim and now delegates to the unified RPC.
 *
 * The legacy "orphan-then-delete" approach left payments dangling in the database
 * (session_id = NULL). The new RPC handles transactions, cobrancas, the session
 * itself, and the linked appointment atomically.
 */

export interface DeletionOptions {
  paymentAction: 'preserve' | 'refund' | 'remove';
  userId: string;
}

/**
 * Resolve the session primary key (uuid) from its text session_id.
 */
async function resolveSessionPk(sessionTextId: string, userId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('clientes_sessoes')
    .select('id')
    .eq('session_id', sessionTextId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    console.error('❌ resolveSessionPk error:', error);
    return null;
  }
  return data?.id ?? null;
}

/**
 * @deprecated Delegates to the unified RPC with action='preserve' semantics
 * (orphans payments, then deletes the session). New code should call the RPC directly.
 */
export async function orphanPaymentsThenDeleteSession(userId: string, sessionTextId: string) {
  const sessionPk = await resolveSessionPk(sessionTextId, userId);
  if (!sessionPk) {
    throw new Error('Sessão não encontrada para exclusão');
  }

  // 'refund' without paid items behaves like the historic preserve flow but cleans up properly.
  const { data, error } = await supabase.rpc('delete_workflow_session_cascade', {
    p_session_pk: sessionPk,
    p_action: 'refund',
  });

  if (error) throw error;
  return { success: true, result: data, sessionId: sessionTextId };
}

/**
 * @deprecated Delegates to the unified RPC. Maps the legacy options to the new actions.
 */
export async function deleteSessionWithOptions(sessionTextId: string, options: DeletionOptions) {
  const { paymentAction, userId } = options;

  const sessionPk = await resolveSessionPk(sessionTextId, userId);
  if (!sessionPk) {
    throw new Error('Sessão não encontrada para exclusão');
  }

  const { data, error } = await supabase.rpc('delete_workflow_session_cascade', {
    p_session_pk: sessionPk,
    p_action: paymentAction,
  });

  if (error) throw error;
  return { success: true, result: data, sessionId: sessionTextId };
}

/**
 * Get orphaned payments (payments without session_id) — uses the dedicated view
 * which is RLS-scoped to the current user via security_invoker.
 */
export async function getOrphanedPayments(_userId: string) {
  try {
    const { data, error } = await supabase
      .from('vw_transacoes_orfas' as any)
      .select('*');

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('❌ Error getting orphaned payments:', error);
    throw error;
  }
}

/**
 * Clean up orphaned payments older than specified days.
 * Kept for compatibility — runs a direct DELETE filtered by user.
 */
export async function cleanupOrphanedPayments(userId: string, olderThanDays: number = 30) {
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
