import { useSensors, useSensor, PointerSensor } from '@dnd-kit/core';

export function useLeadDndSensors() {
  return useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );
}