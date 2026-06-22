/**
 * Container de injeção de dependências do módulo Agenda.
 * Permite trocar a implementação Supabase por mocks em testes.
 */
import type { AppointmentsRepository } from "../domain/ports";
import type { AvailabilityRepository } from "../domain/ports.availability";
import { SupabaseAppointmentsRepository } from "./appointments.supabase";
import { SupabaseAvailabilityRepository } from "./availability.supabase";

export interface AgendaDeps {
  appointments: AppointmentsRepository;
  availability: AvailabilityRepository;
}

let overrides: Partial<AgendaDeps> = {};
let singleton: AgendaDeps | null = null;

export function setAgendaDeps(deps: Partial<AgendaDeps>) {
  overrides = { ...overrides, ...deps };
  singleton = null;
}

export function getAgendaDeps(): AgendaDeps {
  if (!singleton) {
    singleton = {
      appointments: overrides.appointments ?? new SupabaseAppointmentsRepository(),
      availability: overrides.availability ?? new SupabaseAvailabilityRepository(),
    };
  }
  return singleton;
}
