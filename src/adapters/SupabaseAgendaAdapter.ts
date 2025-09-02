import { AgendaStorageAdapter } from './AgendaStorageAdapter';
import { Appointment } from '@/hooks/useAgenda';
import { AvailabilitySlot, AvailabilityType } from '@/types/availability';
import { AgendaSettings } from '@/types/agenda-supabase';

/**
 * Supabase implementation of AgendaStorageAdapter
 * Stub for future implementation when Supabase integration is activated
 */
export class SupabaseAgendaAdapter extends AgendaStorageAdapter {
  
  // Appointments
  async loadAppointments(): Promise<Appointment[]> {
    // TODO: Implement Supabase query
    throw new Error('Supabase integration not implemented yet');
  }

  async saveAppointment(appointment: Appointment): Promise<Appointment> {
    // TODO: Implement Supabase insert
    throw new Error('Supabase integration not implemented yet');
  }

  async updateAppointment(id: string, updates: Partial<Appointment>): Promise<void> {
    // TODO: Implement Supabase update
    throw new Error('Supabase integration not implemented yet');
  }

  async deleteAppointment(id: string): Promise<void> {
    // TODO: Implement Supabase delete
    throw new Error('Supabase integration not implemented yet');
  }

  // Availability
  async loadAvailabilitySlots(): Promise<AvailabilitySlot[]> {
    // TODO: Implement Supabase query
    throw new Error('Supabase integration not implemented yet');
  }

  async saveAvailabilitySlots(slots: AvailabilitySlot[]): Promise<void> {
    // TODO: Implement Supabase insert/update
    throw new Error('Supabase integration not implemented yet');
  }

  async deleteAvailabilitySlot(id: string): Promise<void> {
    // TODO: Implement Supabase delete
    throw new Error('Supabase integration not implemented yet');
  }

  async clearAvailabilityForDate(date: string): Promise<void> {
    // TODO: Implement Supabase delete with date filter
    throw new Error('Supabase integration not implemented yet');
  }

  // Availability Types
  async loadAvailabilityTypes(): Promise<AvailabilityType[]> {
    // TODO: Implement Supabase query
    throw new Error('Supabase integration not implemented yet');
  }

  async saveAvailabilityType(type: AvailabilityType): Promise<AvailabilityType> {
    // TODO: Implement Supabase insert
    throw new Error('Supabase integration not implemented yet');
  }

  async updateAvailabilityType(id: string, updates: Partial<AvailabilityType>): Promise<void> {
    // TODO: Implement Supabase update
    throw new Error('Supabase integration not implemented yet');
  }

  async deleteAvailabilityType(id: string): Promise<void> {
    // TODO: Implement Supabase delete
    throw new Error('Supabase integration not implemented yet');
  }

  // Settings
  async loadSettings(): Promise<AgendaSettings> {
    // TODO: Implement Supabase query
    throw new Error('Supabase integration not implemented yet');
  }

  async saveSettings(settings: AgendaSettings): Promise<void> {
    // TODO: Implement Supabase insert/update
    throw new Error('Supabase integration not implemented yet');
  }
}