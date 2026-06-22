/**
 * Entry-point público do módulo Agenda.
 * Importe SOMENTE deste arquivo no resto do app — internals podem mudar.
 */

// garante que os eventos do módulo entram no LunariEvents
import "./domain/events";

// Capabilities (queries)
export { listAppointmentsByRange } from "./application/queries/listAppointmentsByRange";
export { getAppointmentById } from "./application/queries/getAppointmentById";
export { listAvailability } from "./application/queries/listAvailability";
export { findNextAvailableSlot } from "./application/queries/findNextAvailableSlot";
export { checkSlot } from "./application/queries/checkSlot";

// Capabilities (commands)
export { createAppointment } from "./application/commands/createAppointment";
export { confirmAppointment } from "./application/commands/confirmAppointment";
export { rescheduleAppointment } from "./application/commands/rescheduleAppointment";
export { updateAppointment } from "./application/commands/updateAppointment";
export { cancelAppointment } from "./application/commands/cancelAppointment";
export { addAvailabilitySlots } from "./application/commands/addAvailabilitySlots";
export { clearAvailabilityForDate } from "./application/commands/clearAvailabilityForDate";
export { deleteAvailabilitySlot } from "./application/commands/deleteAvailabilitySlot";

// Tipos públicos
export type {
  Appointment,
  NewAppointment,
  AppointmentStatus,
  AvailabilitySlot,
  NewAvailabilitySlot,
  DateRange,
  DeletionAction,
} from "./domain/types";

// Lógica pura reaproveitável
export {
  findConflicts,
  hasConfirmedConflict,
  findNextFreeSlot,
  sameSlot,
  addDaysISO,
} from "./domain/conflict";

// DI
export { setAgendaDeps, getAgendaDeps } from "./infrastructure/container";
export type { AgendaDeps } from "./infrastructure/container";
export type { AppointmentsRepository } from "./domain/ports";
export type { AvailabilityRepository } from "./domain/ports.availability";

// Erros
export { AgendaErrorCodes } from "./domain/errors";
export type { AgendaErrorCode } from "./domain/errors";

/**
 * Lista das capabilities deste módulo (para exposição ao AI Assistant futuro).
 * Mantida explicitamente para evitar import side-effect surprises.
 */
import { listAppointmentsByRange as _l1 } from "./application/queries/listAppointmentsByRange";
import { getAppointmentById as _l2 } from "./application/queries/getAppointmentById";
import { listAvailability as _l3 } from "./application/queries/listAvailability";
import { findNextAvailableSlot as _l4 } from "./application/queries/findNextAvailableSlot";
import { checkSlot as _l5 } from "./application/queries/checkSlot";
import { createAppointment as _c1 } from "./application/commands/createAppointment";
import { confirmAppointment as _c2 } from "./application/commands/confirmAppointment";
import { rescheduleAppointment as _c3 } from "./application/commands/rescheduleAppointment";
import { cancelAppointment as _c4 } from "./application/commands/cancelAppointment";
import { addAvailabilitySlots as _c5 } from "./application/commands/addAvailabilitySlots";
import { clearAvailabilityForDate as _c6 } from "./application/commands/clearAvailabilityForDate";
import { deleteAvailabilitySlot as _c7 } from "./application/commands/deleteAvailabilitySlot";

export const agendaCapabilities = [
  _l1, _l2, _l3, _l4, _l5,
  _c1, _c2, _c3, _c4, _c5, _c6, _c7,
] as const;

// Camada de apresentação (Onda 3): hooks React + bridge de invalidação
export * from "./presentation";
