import { Appointment } from '@/hooks/useAgenda';
import { AvailabilitySlot, AvailabilityType } from '@/types/availability';
import { AgendaSettings } from '@/types/agenda-supabase';

/**
 * Abstract adapter for agenda data persistence
 * Allows switching between localStorage and Supabase implementations
 */
export abstract class AgendaStorageAdapter {
  // Appointments
  abstract loadAppointments(): Promise<Appointment[]>;
  abstract saveAppointment(appointment: Appointment): Promise<Appointment>;
  abstract updateAppointment(id: string, updates: Partial<Appointment>): Promise<void>;
  abstract deleteAppointment(id: string, preservePayments?: boolean): Promise<void>;

  // Availability
  abstract loadAvailabilitySlots(): Promise<AvailabilitySlot[]>;
  abstract saveAvailabilitySlots(slots: AvailabilitySlot[]): Promise<void>;
  abstract addAvailabilitySlots(slots: Omit<AvailabilitySlot, 'id'>[]): Promise<void>;
  abstract deleteAvailabilitySlot(id: string): Promise<void>;
  abstract clearAvailabilityForDate(date: string): Promise<void>;

  // Availability Types
  abstract loadAvailabilityTypes(): Promise<AvailabilityType[]>;
  abstract saveAvailabilityType(type: AvailabilityType): Promise<AvailabilityType>;
  abstract updateAvailabilityType(id: string, updates: Partial<AvailabilityType>): Promise<void>;
  abstract deleteAvailabilityType(id: string): Promise<void>;

  // Settings
  abstract loadSettings(): Promise<AgendaSettings>;
  abstract saveSettings(settings: AgendaSettings): Promise<void>;

  // Utility methods
  protected generateId(): string {
    return Date.now().toString() + Math.random().toString(36).substr(2, 9);
  }

  protected formatDateForStorage(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  /**
   * Converte string YYYY-MM-DD em Date object
   * IMPORTANTE: Cria Date em timezone LOCAL para evitar deslocamentos
   * 
   * @param dateStr - String no formato YYYY-MM-DD
   * @returns Date object em timezone local
   */
  protected parseDateFromStorage(dateStr: string): Date {
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, day);
  }
}