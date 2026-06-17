import { supabase } from '@/integrations/supabase/client';

interface AllowBlockedArgs {
  slotId?: string;
  fullDay?: boolean;
  date?: Date | string;
}

const toIsoDate = (d: Date | string): string => {
  if (typeof d === 'string') return d.slice(0, 10);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

/**
 * Libera o próximo INSERT/UPDATE em `appointments` para ignorar a verificação
 * de slot bloqueado e remove o(s) slot(s) bloqueado(s) correspondente(s).
 *
 * - `slotId`: remove apenas o slot informado (bloqueio pontual).
 * - `fullDay + date`: remove todos os slots bloqueados do dia (bloqueio de dia inteiro).
 */
export async function allowBlockedWrite(arg?: string | AllowBlockedArgs): Promise<void> {
  const args: AllowBlockedArgs = typeof arg === 'string' ? { slotId: arg } : arg ?? {};
  const payload = {
    p_slot_id: args.slotId ?? null,
    p_full_day: !!args.fullDay,
    p_date: args.date ? toIsoDate(args.date) : null,
  };
  const { error } = await supabase.rpc('agenda_allow_blocked_write', payload as any);
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
    (error as any)?.details ||
    String(error || '');
  if (message.includes('AGENDA_SLOT_BUSY')) return 'busy';
  if (message.includes('AGENDA_SLOT_BLOCKED')) return 'blocked';
  return null;
}

/** Mensagem amigável para um erro do trigger (fallback quando não há dialog). */
export function extractAgendaErrorMessage(error: unknown): string {
  const kind = parseAgendaTriggerError(error);
  if (kind === 'busy') return 'Já existe um agendamento confirmado neste horário.';
  if (kind === 'blocked') return 'Este horário está bloqueado. Desbloqueie antes de salvar.';
  const m = (error as any)?.message;
  return m ? `Erro ao salvar agendamento: ${m}` : 'Erro ao salvar agendamento.';
}
