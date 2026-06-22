/**
 * Hooks de leitura (queries) do módulo Agenda. Encapsulam as capabilities
 * via TanStack Query, mantendo cache, refetch e invalidação consistentes.
 */
import { useCapabilityQuery } from "@/shared/capability";
import {
  findNextAvailableSlot,
  getAppointmentById,
  listAppointmentsByRange,
  listAvailability,
} from "../index";
import type { DateRange } from "../domain/types";
import { agendaKeys } from "./keys";

export function useAppointmentsRangeQuery(range: DateRange, options?: { enabled?: boolean }) {
  return useCapabilityQuery(listAppointmentsByRange, range, {
    queryKey: agendaKeys.appointmentsRange(range),
    enabled: options?.enabled,
    staleTime: 30_000,
  });
}

export function useAppointmentByIdQuery(id: string | null | undefined) {
  return useCapabilityQuery(getAppointmentById, { id: id ?? "" }, {
    queryKey: agendaKeys.appointmentById(id ?? ""),
    enabled: Boolean(id),
    staleTime: 30_000,
  });
}

export function useAvailabilityQuery(range: DateRange, options?: { enabled?: boolean }) {
  return useCapabilityQuery(listAvailability, range, {
    queryKey: agendaKeys.availabilityRange(range),
    enabled: options?.enabled,
    staleTime: 30_000,
  });
}

export function useNextFreeSlotQuery(
  input: Parameters<typeof findNextAvailableSlot.execute>[0],
  options?: { enabled?: boolean },
) {
  return useCapabilityQuery(findNextAvailableSlot, input as never, {
    queryKey: agendaKeys.nextFreeSlot(input),
    enabled: options?.enabled,
    staleTime: 10_000,
  });
}
