/**
 * Container de injeção de dependências do módulo Agenda.
 * Permite trocar a implementação Supabase por mocks em testes.
 */
import type { AppointmentsRepository } from "../domain/ports";
import type { AvailabilityRepository } from "../domain/ports.availability";
import type { AvailabilityTypesRepository } from "../domain/ports.availabilityTypes";
import type { SettingsRepository } from "../domain/ports.settings";
import { SupabaseAppointmentsRepository } from "./appointments.supabase";
import { SupabaseAvailabilityRepository } from "./availability.supabase";
import { SupabaseAvailabilityTypesRepository } from "./availabilityTypes.supabase";
import { SupabaseSettingsRepository } from "./settings.supabase";

export interface AgendaDeps {
  appointments: AppointmentsRepository;
  availability: AvailabilityRepository;
  availabilityTypes: AvailabilityTypesRepository;
  settings: SettingsRepository;
}

let overrides: Partial<AgendaDeps> = {};
let singleton: AgendaDeps | null = null;

export function setAgendaDeps(deps: Partial<AgendaDeps>) {
  overrides = { ...overrides, ...deps };
  singleton = null;
}

export function getAgendaDeps(): AgendaDeps {
  if (!singleton) {
    const availabilityTypes =
      overrides.availabilityTypes ?? new SupabaseAvailabilityTypesRepository();
    singleton = {
      appointments: overrides.appointments ?? new SupabaseAppointmentsRepository(),
      availability:
        overrides.availability ?? new SupabaseAvailabilityRepository(availabilityTypes),
      availabilityTypes,
      settings: overrides.settings ?? new SupabaseSettingsRepository(),
    };
  }
  return singleton;
}
