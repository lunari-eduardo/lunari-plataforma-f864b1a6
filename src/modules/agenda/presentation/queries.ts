/**
 * Hooks de leitura (queries) do módulo Agenda. Encapsulam as capabilities
 * via TanStack Query, mantendo cache, refetch e invalidação consistentes.
 */
import { useCapabilityQuery } from "@/shared/capability";
import {
  checkSlot,
  findNextAvailableSlot,
  getAppointmentById,
  listAppointmentsByRange,
  listAvailability,
} from "../index";
import { agendaKeys } from "./keys";

export interface AgendaRange {
  start: string;
  end: string;
}

// A3: cache agressivo. Antes 30s + refetch em foco/mount → GET /appointments
// e /clientes_sessoes a cada troca de aba (2.3k/dia observados). Agora 5min
// + realtime invalidando o mês afetado quando necessário.
const LIST_CACHE = {
  staleTime: 5 * 60_000,
  gcTime: 30 * 60_000,
  refetchOnWindowFocus: false,
  refetchOnMount: false,
  refetchOnReconnect: false,
} as const;

export function useAppointmentsRangeQuery(range: AgendaRange, options?: { enabled?: boolean }) {
  return useCapabilityQuery(listAppointmentsByRange, range, {
    queryKey: agendaKeys.appointmentsRange(range),
    enabled: options?.enabled,
    ...LIST_CACHE,
  });
}

export function useAppointmentByIdQuery(id: string | null | undefined) {
  return useCapabilityQuery(getAppointmentById, { id: id ?? "" }, {
    queryKey: agendaKeys.appointmentById(id ?? ""),
    enabled: Boolean(id),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
}

export function useAvailabilityQuery(range: AgendaRange, options?: { enabled?: boolean }) {
  return useCapabilityQuery(listAvailability, range, {
    queryKey: agendaKeys.availabilityRange(range),
    enabled: options?.enabled,
    ...LIST_CACHE,
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

export interface CheckSlotInput {
  date: string;
  time: string;
  excludeAppointmentId?: string;
}

export function useCheckSlotQuery(input: CheckSlotInput, options?: { enabled?: boolean }) {
  return useCapabilityQuery(checkSlot, input as never, {
    queryKey: agendaKeys.checkSlot(input),
    enabled: options?.enabled ?? Boolean(input.date && input.time),
    staleTime: 5_000,
  });
}
