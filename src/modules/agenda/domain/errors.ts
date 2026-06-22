/**
 * Códigos de erro estáveis do módulo Agenda.
 * Estes códigos NÃO devem ser localizados — são usados por logs, AI tools e testes.
 */
import { domainError } from "@/shared/result";

export const AgendaErrorCodes = {
  AppointmentNotFound: "AGENDA.APPOINTMENT_NOT_FOUND",
  SlotConflict: "AGENDA.SLOT_CONFLICT",
  NoSlotAvailable: "AGENDA.NO_SLOT_AVAILABLE",
  AvailabilityNotFound: "AGENDA.AVAILABILITY_NOT_FOUND",
  InvalidDateRange: "AGENDA.INVALID_DATE_RANGE",
  RepositoryFailure: "AGENDA.REPOSITORY_FAILURE",
} as const;

export type AgendaErrorCode = (typeof AgendaErrorCodes)[keyof typeof AgendaErrorCodes];

export const agendaError = (
  code: AgendaErrorCode,
  message: string,
  details?: Record<string, unknown>,
) => domainError(code, message, { details, retriable: false });
