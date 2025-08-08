import { useAppContext } from '@/contexts/AppContext';
import type { AvailabilitySlot } from '@/types/availability';

export const useAvailability = () => {
  const ctx = useAppContext();
  return {
    availability: ctx.availability,
    addAvailabilitySlots: ctx.addAvailabilitySlots,
    clearAvailabilityForDate: ctx.clearAvailabilityForDate,
    deleteAvailabilitySlot: ctx.deleteAvailabilitySlot,
  } as const;
};
