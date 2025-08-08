
export type RecurrenceType = 'none' | 'next3days' | 'weekly4';

export interface AvailabilitySlot {
  id: string;
  date: string; // yyyy-MM-dd
  time: string; // HH:mm
  duration: number; // minutes
}
