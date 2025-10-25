import { AgendaStorageAdapter } from '@/adapters/AgendaStorageAdapter';
import { Appointment } from '@/hooks/useAgenda';
import { AvailabilitySlot, AvailabilityType } from '@/types/availability';
import { AgendaSettings } from '@/types/agenda-supabase';
import { safeParseInputDate } from '@/utils/dateUtils';

/**
 * Service layer for agenda business logic
 * Coordinates between adapters and provides domain operations
 */
export class AgendaService {
  constructor(private adapter: AgendaStorageAdapter) {}

  // Appointments
  async loadAppointments(): Promise<Appointment[]> {
    return this.adapter.loadAppointments();
  }

  async addAppointment(appointmentData: Omit<Appointment, 'id'>): Promise<Appointment> {
    // ✅ CORREÇÃO TIMEZONE: Se date for string YYYY-MM-DD, usar safeParseInputDate
    let parsedDate: Date;
    if (typeof appointmentData.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(appointmentData.date)) {
      const parsed = safeParseInputDate(appointmentData.date);
      parsedDate = parsed || new Date();
    } else if (appointmentData.date instanceof Date) {
      parsedDate = appointmentData.date;
    } else {
      parsedDate = new Date(appointmentData.date);
    }

    const appointment: Appointment = {
      ...appointmentData,
      id: this.generateId(),
      date: parsedDate
    };
    
    return this.adapter.saveAppointment(appointment);
  }

  async updateAppointment(id: string, updates: Partial<Appointment>): Promise<void> {
    await this.adapter.updateAppointment(id, updates);
  }

  async deleteAppointment(id: string, preservePayments?: boolean): Promise<void> {
    await this.adapter.deleteAppointment(id, preservePayments);
  }

  // Availability
  async loadAvailabilitySlots(): Promise<AvailabilitySlot[]> {
    return this.adapter.loadAvailabilitySlots();
  }

  async addAvailabilitySlots(slots: Omit<AvailabilitySlot, 'id'>[]): Promise<void> {
    // ✅ CORREÇÃO: Chamar método correto do adapter que faz INSERT sem IDs
    await this.adapter.addAvailabilitySlots(slots);
  }

  async deleteAvailabilitySlot(id: string): Promise<void> {
    await this.adapter.deleteAvailabilitySlot(id);
  }

  async clearAvailabilityForDate(date: string): Promise<void> {
    await this.adapter.clearAvailabilityForDate(date);
  }

  // Availability Types
  async loadAvailabilityTypes(): Promise<AvailabilityType[]> {
    return this.adapter.loadAvailabilityTypes();
  }

  async addAvailabilityType(typeData: Omit<AvailabilityType, 'id'>): Promise<AvailabilityType> {
    const type: AvailabilityType = {
      ...typeData,
      id: this.generateId()
    };
    
    return this.adapter.saveAvailabilityType(type);
  }

  async updateAvailabilityType(id: string, updates: Partial<AvailabilityType>): Promise<void> {
    await this.adapter.updateAvailabilityType(id, updates);
  }

  async deleteAvailabilityType(id: string): Promise<void> {
    await this.adapter.deleteAvailabilityType(id);
  }

  // Settings
  async loadSettings(): Promise<AgendaSettings> {
    return this.adapter.loadSettings();
  }

  async saveSettings(settings: AgendaSettings): Promise<void> {
    await this.adapter.saveSettings(settings);
  }

  // Utility methods
  private generateId(): string {
    return Date.now().toString() + Math.random().toString(36).substr(2, 9);
  }

  // Business logic methods
  async getAppointmentsForDate(date: Date): Promise<Appointment[]> {
    const appointments = await this.loadAppointments();
    const targetDate = date.toDateString();
    
    return appointments.filter(appointment => 
      appointment.date.toDateString() === targetDate
    );
  }

  async getAppointmentsForDateRange(startDate: Date, endDate: Date): Promise<Appointment[]> {
    const appointments = await this.loadAppointments();
    
    return appointments.filter(appointment => 
      appointment.date >= startDate && appointment.date <= endDate
    );
  }

  async getConfirmedAppointments(): Promise<Appointment[]> {
    const appointments = await this.loadAppointments();
    return appointments.filter(appointment => appointment.status === 'confirmado');
  }

  async hasConflictingAppointment(date: Date, time: string, excludeId?: string): Promise<boolean> {
    const appointments = await this.getAppointmentsForDate(date);
    
    return appointments.some(appointment => 
      appointment.time === time && 
      appointment.id !== excludeId
    );
  }
}