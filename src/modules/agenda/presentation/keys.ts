/**
 * Query keys do módulo Agenda. Centralizadas para que invalidações
 * (incl. as do bridge de eventos) atinjam exatamente os caches certos.
 */
export const agendaKeys = {
  all: ["agenda"] as const,
  appointments: () => [...agendaKeys.all, "appointments"] as const,
  appointmentsRange: (range: { start: string; end: string }) =>
    [...agendaKeys.appointments(), "range", range.start, range.end] as const,
  appointmentById: (id: string) => [...agendaKeys.appointments(), "byId", id] as const,
  availability: () => [...agendaKeys.all, "availability"] as const,
  availabilityRange: (range: { start: string; end: string }) =>
    [...agendaKeys.availability(), "range", range.start, range.end] as const,
  nextFreeSlot: (input: unknown) => [...agendaKeys.all, "nextFreeSlot", input] as const,
} as const;
