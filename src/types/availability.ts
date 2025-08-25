
export type RecurrenceType = 'none' | 'next3days' | 'weekly4';

export interface AvailabilityType {
  id: string;
  name: string;
  color: string;
}

export interface AvailabilitySlot {
  id: string;
  date: string; // yyyy-MM-dd
  time: string; // HH:mm
  duration: number; // minutes
  typeId?: string; // ID do tipo de disponibilidade
  label?: string; // Cache do nome do tipo
  color?: string; // Cache da cor do tipo
}
