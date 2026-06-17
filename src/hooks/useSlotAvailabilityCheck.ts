import { useCallback } from 'react';
import { isSameDay, parseISO } from 'date-fns';
import { useAppContext } from '@/contexts/AppContext';
import { useAvailability } from './useAvailability';
import type { Appointment, AppointmentStatus } from './useAgenda';
import type { AvailabilitySlot } from '@/types/availability';

export type SlotCheckResult =
  | { kind: 'free' }
  | { kind: 'busy'; appointment: Appointment }
  | { kind: 'pending'; appointments: Appointment[] }
  | { kind: 'blocked'; slot: AvailabilitySlot };

interface CheckSlotArgs {
  date: Date;
  time: string;
  ignoreAppointmentId?: string;
  /** Status pretendido para o agendamento sendo gravado. */
  targetStatus?: AppointmentStatus;
}

/** Normaliza HH:mm:ss -> HH:mm */
export const normalizeHHmm = (t?: string | null): string => {
  if (!t) return '';
  const s = String(t).trim();
  return s.length >= 5 ? s.slice(0, 5) : s;
};

const toDate = (d: Date | string): Date => {
  if (d instanceof Date) return d;
  try {
    return parseISO(d as string);
  } catch {
    return new Date(d as string);
  }
};

/** Identifica se um slot de disponibilidade representa um bloqueio. */
export const isBlockedSlot = (s: AvailabilitySlot): boolean => {
  const label = (s.label || '').toLowerCase();
  const typeId = (s.typeId || '').toLowerCase();
  if (typeId.startsWith('bloque')) return true;
  if (label.startsWith('bloque')) return true;
  if (s.isFullDay && s.fullDayDescription) return true;
  return false;
};

/**
 * Hook centralizado de validação de slot da agenda.
 * Ordem de prioridade:
 *  1. confirmado de outro agendamento -> busy
 *  2. slot bloqueado pelo usuário -> blocked
 *  3. pendentes no mesmo horário -> pending
 *  4. livre
 */
export const useSlotAvailabilityCheck = () => {
  const { appointments } = useAppContext();
  const { availability } = useAvailability();

  const checkSlot = useCallback(
    ({ date, time, ignoreAppointmentId, targetStatus }: CheckSlotArgs): SlotCheckResult => {
      const wantedTime = normalizeHHmm(time);
      const sameSlot = appointments.filter(
        (app) =>
          app.id !== ignoreAppointmentId &&
          isSameDay(toDate(app.date), date) &&
          normalizeHHmm(app.time) === wantedTime,
      );

      // 1. Confirmado já existente -> busy (sempre bloqueia)
      const confirmed = sameSlot.find((app) => app.status === 'confirmado');
      if (confirmed) {
        return { kind: 'busy', appointment: confirmed };
      }

      // 2. Bloqueado pelo usuário (slot ou dia inteiro)
      const yyyy = date.getFullYear();
      const mm = String(date.getMonth() + 1).padStart(2, '0');
      const dd = String(date.getDate()).padStart(2, '0');
      const dateStr = `${yyyy}-${mm}-${dd}`;
      const blocked = availability.find(
        (s) =>
          s.date === dateStr &&
          isBlockedSlot(s) &&
          (s.isFullDay || normalizeHHmm(s.time) === wantedTime),
      );
      if (blocked) {
        return { kind: 'blocked', slot: blocked };
      }

      // 3. Pendentes (aviso para o usuário)
      const pendings = sameSlot.filter((app) => app.status === 'a confirmar');
      if (pendings.length > 0) {
        return { kind: 'pending', appointments: pendings };
      }

      return { kind: 'free' };
    },
    [appointments, availability],
  );

  /**
   * Tenta reconstruir um SlotCheckResult a partir de uma exception do trigger DB.
   * Útil quando a validação client-side não capturou o conflito (race, formato divergente etc).
   */
  const buildResultFromError = useCallback(
    (kind: 'busy' | 'blocked', date: Date, time: string): SlotCheckResult => {
      // Tenta achar o registro real para enriquecer o dialog
      const check = checkSlot({ date, time });
      if (kind === 'busy' && check.kind === 'busy') return check;
      if (kind === 'blocked' && check.kind === 'blocked') return check;
      if (kind === 'busy') {
        return {
          kind: 'busy',
          appointment: {
            id: '__db__',
            title: 'Outro agendamento',
            client: 'Outro agendamento',
            date,
            time,
            type: '',
            status: 'confirmado',
          } as unknown as Appointment,
        };
      }
      return {
        kind: 'blocked',
        slot: {
          id: '',
          date: date.toISOString().split('T')[0],
          time,
          duration: 0,
          typeId: 'bloqueado',
          label: 'Bloqueado',
          color: '#ef4444',
          isFullDay: false,
        } as AvailabilitySlot,
      };
    },
    [checkSlot],
  );

  return { checkSlot, buildResultFromError };
};
