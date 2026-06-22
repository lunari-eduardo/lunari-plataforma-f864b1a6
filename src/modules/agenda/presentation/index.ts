export { agendaKeys } from "./keys";
export {
  useAppointmentsRangeQuery,
  useAppointmentByIdQuery,
  useAvailabilityQuery,
  useNextFreeSlotQuery,
  useCheckSlotQuery,
  type AgendaRange,
  type CheckSlotInput,
} from "./queries";
export {
  useUnifiedEventsRangeQuery,
  type UnifiedEvent,
} from "./unifiedEvents";
export {
  useCreateAppointmentMutation,
  useConfirmAppointmentMutation,
  useRescheduleAppointmentMutation,
  useCancelAppointmentMutation,
  useAddAvailabilityMutation,
  useClearAvailabilityMutation,
  useDeleteAvailabilitySlotMutation,
} from "./mutations";
export { AgendaInvalidationBridge } from "./AgendaInvalidationBridge";
export { useLegacyAgendaMutations } from "./legacyMutations";
export {
  type Appointment,
  type AppointmentStatus,
  type ProdutoIncluido,
} from "./types";

