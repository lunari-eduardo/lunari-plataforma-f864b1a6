import { useCallback } from 'react';
import { isSameDay } from 'date-fns';
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

/**
 * Hook centralizado de validação de slot da agenda.
 * Ordem de prioridade:
 *  1. confirmado de outro agendamento → busy
 *  2. slot bloqueado pelo usuário → blocked
 *  3. pendentes no mesmo horário → pending
 *  4. livre
 */
export const useSlotAvailabilityCheck = () => {
  const { appointments } = useAppContext();
  const { availability } = useAvailability();

  const checkSlot = useCallback(
    ({ date, time, ignoreAppointmentId, targetStatus }: CheckSlotArgs): SlotCheckResult => {
      const sameSlot = appointments.filter(
        (app) =>
          app.id !== ignoreAppointmentId &&
          isSameDay(app.date, date) &&
          app.time === time,
      );

      // 1. Confirmado já existente → busy (sempre bloqueia)
      const confirmed = sameSlot.find((app) => app.status === 'confirmado');
      if (confirmed) {
        return { kind: 'busy', appointment: confirmed };
      }

      // 2. Bloqueado pelo usuário (slot ou dia inteiro)
      const dateStr = date.toISOString().split('T')[0];
      const blocked = availability.find(
        (s) =>
          s.date === dateStr &&
          s.label === 'Bloqueado' &&
          (s.isFullDay || s.time === time),
      );
      if (blocked) {
        return { kind: 'blocked', slot: blocked };
      }

      // 3. Pendentes (aviso, não bloqueia)
      const pendings = sameSlot.filter((app) => app.status === 'a confirmar');
      if (pendings.length > 0 && targetStatus !== 'a confirmar') {
        // Se está confirmando sobre pendentes, indica conflito
        return { kind: 'pending', appointments: pendings };
      }
      if (pendings.length > 0 && targetStatus === 'a confirmar') {
        return { kind: 'pending', appointments: pendings };
      }

      return { kind: 'free' };
    },
    [appointments, availability],
  );

  return { checkSlot };
};
