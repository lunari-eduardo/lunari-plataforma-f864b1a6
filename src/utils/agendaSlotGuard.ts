import { supabase } from '@/integrations/supabase/client';

/**
 * Libera o próximo INSERT/UPDATE em `appointments` para ignorar a verificação
 * de slot bloqueado e (opcionalmente) remove o slot bloqueado correspondente.
 *
 * Deve ser chamado IMEDIATAMENTE antes de gravar o agendamento.
 * O efeito vale só para esta requisição HTTP (sessão do PostgREST).
 */
export async function allowBlockedWrite(slotId?: string): Promise<void> {
  const { error } = await supabase.rpc('agenda_allow_blocked_write', {
    p_slot_id: slotId ?? null,
  } as any);
  if (error) {
    console.error('[allowBlockedWrite] erro:', error);
    throw error;
  }
}

/** Detecta as exceptions lançadas pelo trigger de agenda. */
export function parseAgendaTriggerError(error: unknown): 'busy' | 'blocked' | null {
  const message =
    (error as any)?.message ||
    (error as any)?.error?.message ||
    String(error || '');
  if (message.includes('AGENDA_SLOT_BUSY')) return 'busy';
  if (message.includes('AGENDA_SLOT_BLOCKED')) return 'blocked';
  return null;
}
