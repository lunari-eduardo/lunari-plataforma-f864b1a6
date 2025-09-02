import { useAgendaContext } from '@/contexts/AgendaContext';

export const useAvailability = () => {
  const {
    availability,
    availabilityTypes,
    addAvailabilitySlots,
    clearAvailabilityForDate,
    deleteAvailabilitySlot,
    addAvailabilityType,
    updateAvailabilityType,
    deleteAvailabilityType,
    getAvailabilityForDate
  } = useAgendaContext();
  
  return {
    availability,
    availabilityTypes,
    addAvailabilitySlots,
    clearAvailabilityForDate,
    deleteAvailabilitySlot,
    addAvailabilityType,
    updateAvailabilityType,
    deleteAvailabilityType,
    getAvailabilityForDate
  } as const;
};
