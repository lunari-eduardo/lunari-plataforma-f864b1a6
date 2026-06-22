import { useAgendaContext } from '@/contexts/AgendaContext';
import type { AvailabilitySlot } from '@/types/availability';

/**
 * @deprecated Use `useAvailabilityQuery`, `useAddAvailabilityMutation` and
 * `useClearAvailabilityMutation` from `@/modules/agenda` instead.
 */

export const useAvailability = () => {
  const ctx = useAgendaContext();
  return {
    availability: ctx.availability,
    availabilityTypes: ctx.availabilityTypes,
    addAvailabilitySlots: ctx.addAvailabilitySlots,
    clearAvailabilityForDate: ctx.clearAvailabilityForDate,
    deleteAvailabilitySlot: ctx.deleteAvailabilitySlot,
    addAvailabilityType: ctx.addAvailabilityType,
    updateAvailabilityType: ctx.updateAvailabilityType,
    deleteAvailabilityType: ctx.deleteAvailabilityType,
  } as const;
};
