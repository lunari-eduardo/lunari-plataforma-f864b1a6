/**
 * Adaptador transitório (Onda 6 step 3): expõe a API legada de mutações
 * (`addAppointment`, `updateAppointment`, `deleteAppointment`, `loadMonthData`)
 * a partir do módulo, isolando consumidores como `Agenda.tsx` e
 * `LeadSchedulingModal` do hook legado `@/hooks/useAgenda`.
 *
 * Internamente ainda delega ao `useAppointments`, que será desmontado na Onda 7
 * em favor das mutations baseadas em capabilities (`useCreateAppointmentMutation` etc.).
 */
import { useAppointments } from "@/hooks/useAppointments";

export function useLegacyAgendaMutations() {
  const { addAppointment, updateAppointment, deleteAppointment, loadMonthData, appointments } =
    useAppointments();
  return { addAppointment, updateAppointment, deleteAppointment, loadMonthData, appointments };
}
