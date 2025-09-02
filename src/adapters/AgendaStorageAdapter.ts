// Adapter abstrato para armazenamento de dados da agenda
// Permite trocar entre localStorage e Supabase facilmente

import { Appointment } from '@/hooks/useAgenda';
import { AvailabilitySlot, AvailabilityType } from '@/types/availability';
import { AgendaSettings } from '@/types/agenda-supabase';

export interface AppointmentFilters {
  startDate?: Date;
  endDate?: Date;
  status?: string;
  client?: string;
}

export interface AvailabilityFilters {
  startDate?: Date;
  endDate?: Date;
  typeId?: string;
}

export abstract class AgendaStorageAdapter {
  // Appointments CRUD
  abstract getAppointments(filters?: AppointmentFilters): Promise<Appointment[]>;
  abstract createAppointment(appointment: Omit<Appointment, 'id'>): Promise<Appointment>;
  abstract updateAppointment(id: string, updates: Partial<Appointment>): Promise<Appointment>;
  abstract deleteAppointment(id: string): Promise<void>;
  
  // Availability CRUD
  abstract getAvailabilitySlots(filters?: AvailabilityFilters): Promise<AvailabilitySlot[]>;
  abstract createAvailabilitySlots(slots: Omit<AvailabilitySlot, 'id'>[]): Promise<AvailabilitySlot[]>;
  abstract deleteAvailabilitySlot(id: string): Promise<void>;
  abstract clearAvailabilityForDate(date: string): Promise<void>;
  
  // Availability Types CRUD
  abstract getAvailabilityTypes(): Promise<AvailabilityType[]>;
  abstract createAvailabilityType(type: Omit<AvailabilityType, 'id'>): Promise<AvailabilityType>;
  abstract updateAvailabilityType(id: string, updates: Partial<AvailabilityType>): Promise<AvailabilityType>;
  abstract deleteAvailabilityType(id: string): Promise<void>;
  
  // Settings
  abstract getAgendaSettings(): Promise<AgendaSettings>;
  abstract updateAgendaSettings(settings: Partial<AgendaSettings>): Promise<AgendaSettings>;
  
  // Utility methods that can be overridden
  generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
  
  // Event listeners para mudanças (útil para real-time updates)
  abstract onAppointmentsChange(callback: (appointments: Appointment[]) => void): () => void;
  abstract onAvailabilityChange(callback: (availability: AvailabilitySlot[]) => void): () => void;
}