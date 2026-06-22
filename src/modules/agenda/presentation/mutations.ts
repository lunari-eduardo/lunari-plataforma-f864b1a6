/**
 * Hooks de escrita (mutations) do módulo Agenda.
 * - Invalidam queries do módulo após sucesso.
 * - Eventos de domínio emitidos pelo handler disparam invalidações adicionais
 *   via `AgendaInvalidationBridge` (cross-tab / cross-module).
 */
import { useQueryClient } from "@tanstack/react-query";
import { useCapabilityMutation, type CapabilityError } from "@/shared/capability";
import {
  addAvailabilitySlots,
  cancelAppointment,
  clearAvailabilityForDate,
  confirmAppointment,
  createAppointment,
  rescheduleAppointment,
} from "../index";
import { agendaKeys } from "./keys";

type MutOpts<T> = {
  onSuccess?: (data: T) => void;
  onError?: (err: CapabilityError) => void;
};

export function useCreateAppointmentMutation(opts: MutOpts<unknown> = {}) {
  const qc = useQueryClient();
  return useCapabilityMutation(createAppointment, {
    ...opts,
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: agendaKeys.appointments() });
      qc.invalidateQueries({ queryKey: agendaKeys.availability() });
      opts.onSuccess?.(data);
    },
  });
}

export function useConfirmAppointmentMutation(opts: MutOpts<unknown> = {}) {
  const qc = useQueryClient();
  return useCapabilityMutation(confirmAppointment, {
    ...opts,
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: agendaKeys.appointments() });
      opts.onSuccess?.(data);
    },
  });
}

export function useRescheduleAppointmentMutation(opts: MutOpts<unknown> = {}) {
  const qc = useQueryClient();
  return useCapabilityMutation(rescheduleAppointment, {
    ...opts,
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: agendaKeys.appointments() });
      qc.invalidateQueries({ queryKey: agendaKeys.availability() });
      opts.onSuccess?.(data);
    },
  });
}

export function useCancelAppointmentMutation(opts: MutOpts<unknown> = {}) {
  const qc = useQueryClient();
  return useCapabilityMutation(cancelAppointment, {
    ...opts,
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: agendaKeys.appointments() });
      qc.invalidateQueries({ queryKey: agendaKeys.availability() });
      opts.onSuccess?.(data);
    },
  });
}

export function useAddAvailabilityMutation(opts: MutOpts<unknown> = {}) {
  const qc = useQueryClient();
  return useCapabilityMutation(addAvailabilitySlots, {
    ...opts,
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: agendaKeys.availability() });
      opts.onSuccess?.(data);
    },
  });
}

export function useClearAvailabilityMutation(opts: MutOpts<unknown> = {}) {
  const qc = useQueryClient();
  return useCapabilityMutation(clearAvailabilityForDate, {
    ...opts,
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: agendaKeys.availability() });
      opts.onSuccess?.(data);
    },
  });
}
