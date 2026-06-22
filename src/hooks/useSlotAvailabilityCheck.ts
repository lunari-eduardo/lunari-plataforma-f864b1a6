import { useCallback } from 'react';
import { useAppContext } from '@/contexts/AppContext';
import { useAvailability } from './useAvailability';
import type { Appointment, AppointmentStatus } from './useAgenda';
import type { AvailabilitySlot } from '@/types/availability';
import {
  classifySlot,
  isBlockedSlot as domainIsBlockedSlot,
} from '@/modules/agenda/domain/slotClassification';
import type {
  Appointment as DomainAppointment,
  AvailabilitySlot as DomainAvailabilitySlot,
} from '@/modules/agenda/domain/types';

export type SlotCheckResult =
  | { kind: 'free' }
  | { kind: 'busy'; appointment: Appointment }
  | { kind: 'pending'; appointments: Appointment[] }
  | { kind: 'blocked'; slot: AvailabilitySlot };

interface CheckSlotArgs {
  date: Date;
  time: string;
  ignoreAppointmentId?: string;
  /** Status pretendido para o agendamento sendo gravado (reservado para uso futuro). */
  targetStatus?: AppointmentStatus;
}

/** Normaliza HH:mm:ss -> HH:mm */
export const normalizeHHmm = (t?: string | null): string => {
  if (!t) return '';
  const s = String(t).trim();
  return s.length >= 5 ? s.slice(0, 5) : s;
};

const toISODate = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
};

const toDate = (d: Date | string): Date =>
  d instanceof Date ? d : new Date(d as string);

/** Reexport — wrapper sobre a função pura do domínio. */
export const isBlockedSlot = (s: AvailabilitySlot): boolean =>
  domainIsBlockedSlot(s as unknown as DomainAvailabilitySlot);

/**
 * Hook centralizado de validação de slot da agenda.
 * Delegado para `classifySlot` (camada de domínio pura) — esta camada apenas
 * adapta os dados do AppContext para o formato do domínio e remapeia o
 * resultado para os tipos legados consumidos pela UI.
 */
export const useSlotAvailabilityCheck = () => {
  const { appointments } = useAppContext();
  const { availability } = useAvailability();

  const checkSlot = useCallback(
    ({ date, time, ignoreAppointmentId }: CheckSlotArgs): SlotCheckResult => {
      const wantedDate = toISODate(date);
      const wantedTime = normalizeHHmm(time);

      // Index legacy appointments by id para remapear depois.
      const legacyById = new Map<string, Appointment>();
      const domainAppointments: DomainAppointment[] = [];
      for (const app of appointments) {
        const appDate = toDate(app.date);
        const dApp = {
          id: app.id,
          title: app.title,
          date: toISODate(appDate),
          time: normalizeHHmm(app.time),
          type: app.type ?? '',
          client: app.client ?? '',
          status: app.status as DomainAppointment['status'],
        } as DomainAppointment;
        domainAppointments.push(dApp);
        legacyById.set(app.id, app);
      }

      const domainAvailability = availability as unknown as DomainAvailabilitySlot[];

      const result = classifySlot(domainAppointments, domainAvailability, {
        date: wantedDate,
        time: wantedTime,
        excludeAppointmentId: ignoreAppointmentId,
      });

      switch (result.kind) {
        case 'free':
          return { kind: 'free' };
        case 'busy':
          return {
            kind: 'busy',
            appointment: legacyById.get(result.appointment.id) ?? (result.appointment as unknown as Appointment),
          };
        case 'pending':
          return {
            kind: 'pending',
            appointments: result.appointments.map(
              (a) => legacyById.get(a.id) ?? (a as unknown as Appointment),
            ),
          };
        case 'blocked':
          return { kind: 'blocked', slot: result.slot as unknown as AvailabilitySlot };
      }
    },
    [appointments, availability],
  );

  /**
   * Tenta reconstruir um SlotCheckResult a partir de uma exception do trigger DB.
   * Útil quando a validação client-side não capturou o conflito (race, formato divergente etc).
   */
  const buildResultFromError = useCallback(
    (kind: 'busy' | 'blocked', date: Date, time: string): SlotCheckResult => {
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
          date: toISODate(date),
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
