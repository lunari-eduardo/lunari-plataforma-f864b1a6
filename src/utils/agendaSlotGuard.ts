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

/** Detecta as exceptions lançadas pelo trigger de agenda ou pela UNIQUE constraint. */
export function parseAgendaTriggerError(error: unknown): 'busy' | 'blocked' | null {
  const err = error as any;
  const message =
    err?.message ||
    err?.error?.message ||
    err?.details ||
    err?.hint ||
    String(error || '');
  const code = err?.code || err?.error?.code;

  if (message.includes('AGENDA_SLOT_BUSY')) return 'busy';
  if (message.includes('AGENDA_SLOT_BLOCKED')) return 'blocked';

  // UNIQUE constraint da tabela appointments (proteção de última camada contra race)
  if (
    code === '23505' &&
    (message.includes('unique_user_date_time') ||
      message.includes('appointments') ||
      message.includes('duplicate key value violates unique constraint'))
  ) {
    return 'busy';
  }
  if (message.includes('unique_user_date_time')) return 'busy';

  return null;
}

/** Mensagem amigável para um erro do trigger (fallback quando não há dialog). */
export function extractAgendaErrorMessage(error: unknown): string {
  const kind = parseAgendaTriggerError(error);
  if (kind === 'busy') return 'Já existe um agendamento neste horário.';
  if (kind === 'blocked') return 'Este horário está bloqueado. Desbloqueie antes de salvar.';
  const m = (error as any)?.message;
  return m ? `Erro ao salvar agendamento: ${m}` : 'Erro ao salvar agendamento.';
}
