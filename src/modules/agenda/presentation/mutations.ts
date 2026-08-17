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
  deleteAvailabilitySlot,
  rescheduleAppointment,
  updateAppointment,
} from "../index";
import { agendaKeys } from "./keys";

type MutOpts<T> = {
  onSuccess?: (data: T) => void;
  onError?: (err: CapabilityError) => void;
};

function notifyWorkflowSync(dateLike?: any) {
  if (typeof window === "undefined") return;
  try {
    let year: number | undefined;
    let month: number | undefined;
    const dateVal = typeof dateLike === "object" && dateLike?.date ? dateLike.date : dateLike;

    if (typeof dateVal === "string") {
      const parts = dateVal.split("-").map(Number);
      if (parts.length >= 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
        year = parts[0];
        month = parts[1];
      }
    } else if (dateVal instanceof Date && !isNaN(dateVal.getTime())) {
      year = dateVal.getFullYear();
      month = dateVal.getMonth() + 1;
    }

    if (year && month) {
      window.dispatchEvent(
        new CustomEvent("workflow-cache-silent-refresh", {
          detail: { year, month, force: true },
        }),
      );
    } else {
      window.dispatchEvent(
        new CustomEvent("workflow-cache-silent-refresh", {
          detail: { force: true },
        }),
      );
    }
  } catch {
    /* noop */
  }
}

export function useCreateAppointmentMutation(opts: MutOpts<unknown> = {}) {
  const qc = useQueryClient();
  return useCapabilityMutation(createAppointment, {
    ...opts,
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: agendaKeys.appointments() });
      qc.invalidateQueries({ queryKey: agendaKeys.availability() });
      notifyWorkflowSync((data as any)?.date);
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
      notifyWorkflowSync((data as any)?.date);
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
      notifyWorkflowSync((data as any)?.date);
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
      notifyWorkflowSync((data as any)?.date);
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

export function useDeleteAvailabilitySlotMutation(opts: MutOpts<unknown> = {}) {
  const qc = useQueryClient();
  return useCapabilityMutation(deleteAvailabilitySlot, {
    ...opts,
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: agendaKeys.availability() });
      opts.onSuccess?.(data);
    },
  });
}

export function useUpdateAppointmentMutation(opts: MutOpts<unknown> = {}) {
  const qc = useQueryClient();
  return useCapabilityMutation(updateAppointment, {
    ...opts,
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: agendaKeys.appointments() });
      qc.invalidateQueries({ queryKey: agendaKeys.availability() });
      notifyWorkflowSync((data as any)?.date);
      opts.onSuccess?.(data);
    },
  });
}

