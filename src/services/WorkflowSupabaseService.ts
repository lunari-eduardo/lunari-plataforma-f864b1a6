import {
  createSessionFromAppointment,
  hydrateStubSession,
} from "./workflow-supabase/sessionCreationService";
import {
  linkAppointmentToSession,
  getSessionsForMonth,
} from "./workflow-supabase/sessionQueriesService";
import {
  migrateLocalStorageData,
  repairAppointmentsSessionsMismatch,
} from "./workflow-supabase/sessionRepairService";

export {
  createSessionFromAppointment,
  hydrateStubSession,
  linkAppointmentToSession,
  getSessionsForMonth,
  migrateLocalStorageData,
  repairAppointmentsSessionsMismatch,
};

/**
 * IMPORTANTE - SINCRONIZAÇÃO DE DATAS:
 * - appointments.date ↔ clientes_sessoes.data_sessao (sincronizado via trigger)
 * - appointments.time ↔ clientes_sessoes.hora_sessao (sincronizado via trigger)
 * - Trigger: sync_appointment_date_to_session (ativa em UPDATE de date/time)
 * - Sempre usar formatDateForStorage() para evitar bugs de timezone
 *
 * Service for handling workflow integration with appointments
 * Automatically creates workflow sessions when appointments are confirmed
 */
export class WorkflowSupabaseService {
  /**
   * Create workflow session from confirmed appointment
   * Uses lock mechanism to prevent duplicate session creation
   */
  static async createSessionFromAppointment(
    appointmentId: string,
    appointmentData: any,
  ) {
    return createSessionFromAppointment(appointmentId, appointmentData);
  }

  /**
   * Update appointment link in existing session
   */
  static async linkAppointmentToSession(
    sessionId: string,
    appointmentId: string,
  ) {
    return linkAppointmentToSession(sessionId, appointmentId);
  }

  /**
   * Get sessions for a specific month with package information
   */
  static async getSessionsForMonth(month: number, year: number) {
    return getSessionsForMonth(month, year);
  }

  /**
   * Migrate localStorage data to Supabase
   */
  static async migrateLocalStorageData() {
    return migrateLocalStorageData();
  }

  /**
   * Reparar divergências entre appointments e clientes_sessoes
   */
  static async repairAppointmentsSessionsMismatch() {
    return repairAppointmentsSessionsMismatch((appointmentId, appointment) =>
      createSessionFromAppointment(appointmentId, appointment),
    );
  }
}
