import { useAppContext } from '@/contexts/AppContext';
import type { AvailabilitySlot } from '@/types/availability';

export const useAvailability = () => {
  const ctx = useAppContext();
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
