/**
 * Port: repositório de agendamentos.
 * Application depende desta interface, NÃO da implementação Supabase.
 */
import type {
  Appointment,
  DateRange,
  DeletionAction,
  NewAppointment,
} from "../domain/types";

export interface AppointmentsRepository {
  listByRange(range: DateRange): Promise<Appointment[]>;
  getById(id: string): Promise<Appointment | null>;
  create(input: NewAppointment): Promise<Appointment>;
  update(id: string, patch: Partial<NewAppointment>): Promise<void>;
  delete(id: string, action?: DeletionAction): Promise<void>;
}
