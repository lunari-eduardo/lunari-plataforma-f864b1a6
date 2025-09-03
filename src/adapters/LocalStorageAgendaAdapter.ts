import { AgendaStorageAdapter } from './AgendaStorageAdapter';
import { Appointment } from '@/hooks/useAgenda';
import { AvailabilitySlot, AvailabilityType } from '@/types/availability';
import { AgendaSettings } from '@/types/agenda-supabase';
import { storage, STORAGE_KEYS } from '@/utils/localStorage';

/**
 * Local Storage implementation of AgendaStorageAdapter
 * Preserves existing localStorage functionality
 */
export class LocalStorageAgendaAdapter extends AgendaStorageAdapter {

  // Appointments
  async loadAppointments(): Promise<Appointment[]> {
    try {
      const appointments = storage.load(STORAGE_KEYS.APPOINTMENTS, []);
      return appointments.map((app: any) => ({
        ...app,
        date: new Date(app.date),
      }));
    } catch (error) {
      return [];
    }
  }

  async saveAppointment(appointment: Appointment): Promise<Appointment> {
    try {
      const appointments = await this.loadAppointments();
      const newAppointment = {
        ...appointment,
        id: appointment.id || this.generateId(),
        date: appointment.date instanceof Date ? appointment.date : new Date(appointment.date)
      };
      
      appointments.push(newAppointment);
      storage.save(STORAGE_KEYS.APPOINTMENTS, appointments);
      return newAppointment;
    } catch (error) {
      throw error;
    }
  }

  async updateAppointment(id: string, updates: Partial<Appointment>): Promise<void> {
    try {
      const appointments = await this.loadAppointments();
      const index = appointments.findIndex(app => app.id === id);
      
      if (index !== -1) {
        appointments[index] = { 
          ...appointments[index], 
          ...updates,
          date: updates.date instanceof Date ? updates.date : appointments[index].date
        };
        storage.save(STORAGE_KEYS.APPOINTMENTS, appointments);
      }
    } catch (error) {
      throw error;
    }
  }

  async deleteAppointment(id: string): Promise<void> {
    try {
      const appointments = await this.loadAppointments();
      const filtered = appointments.filter(app => app.id !== id);
      storage.save(STORAGE_KEYS.APPOINTMENTS, filtered);
    } catch (error) {
      throw error;
    }
  }

  // Availability
  async loadAvailabilitySlots(): Promise<AvailabilitySlot[]> {
    try {
      return storage.load(STORAGE_KEYS.AVAILABILITY, []);
    } catch (error) {
      return [];
    }
  }

  async saveAvailabilitySlots(slots: AvailabilitySlot[]): Promise<void> {
    try {
      storage.save(STORAGE_KEYS.AVAILABILITY, slots);
    } catch (error) {
      throw error;
    }
  }

  async deleteAvailabilitySlot(id: string): Promise<void> {
    try {
      const slots = await this.loadAvailabilitySlots();
      const filtered = slots.filter(slot => slot.id !== id);
      await this.saveAvailabilitySlots(filtered);
    } catch (error) {
      throw error;
    }
  }

  async clearAvailabilityForDate(date: string): Promise<void> {
    try {
      const slots = await this.loadAvailabilitySlots();
      const filtered = slots.filter(slot => slot.date !== date);
      await this.saveAvailabilitySlots(filtered);
    } catch (error) {
      throw error;
    }
  }

  // Availability Types
  async loadAvailabilityTypes(): Promise<AvailabilityType[]> {
    try {
      const defaultTypes = [
        { id: '1', name: 'Ensaio Gestante', duration: 120, color: '#10b981' },
        { id: '2', name: 'Ensaio Família', duration: 90, color: '#3b82f6' },
        { id: '3', name: 'Ensaio Corporativo', duration: 60, color: '#8b5cf6' },
        { id: '4', name: 'Reunião Cliente', duration: 30, color: '#f59e0b' }
      ];
      return storage.load(STORAGE_KEYS.AVAILABILITY_TYPES, defaultTypes);
    } catch (error) {
      return [];
    }
  }

  async saveAvailabilityType(type: AvailabilityType): Promise<AvailabilityType> {
    try {
      const types = await this.loadAvailabilityTypes();
      const newType = { ...type, id: type.id || this.generateId() };
      types.push(newType);
      storage.save(STORAGE_KEYS.AVAILABILITY_TYPES, types);
      return newType;
    } catch (error) {
      throw error;
    }
  }

  async updateAvailabilityType(id: string, updates: Partial<AvailabilityType>): Promise<void> {
    try {
      const types = await this.loadAvailabilityTypes();
      const index = types.findIndex(type => type.id === id);
      
      if (index !== -1) {
        types[index] = { ...types[index], ...updates };
        storage.save(STORAGE_KEYS.AVAILABILITY_TYPES, types);
      }
    } catch (error) {
      throw error;
    }
  }

  async deleteAvailabilityType(id: string): Promise<void> {
    try {
      const types = await this.loadAvailabilityTypes();
      const filtered = types.filter(type => type.id !== id);
      storage.save(STORAGE_KEYS.AVAILABILITY_TYPES, filtered);
    } catch (error) {
      throw error;
    }
  }

  // Settings
  async loadSettings(): Promise<AgendaSettings> {
    try {
      const defaultSettings = {
        defaultView: 'weekly' as const,
        workingHours: { start: '08:00', end: '18:00' },
        autoConfirmAppointments: false
      };
      return storage.load('lunari_agenda_settings', defaultSettings);
    } catch (error) {
      return {
        defaultView: 'weekly',
        workingHours: { start: '08:00', end: '18:00' },
        autoConfirmAppointments: false
      };
    }
  }

  async saveSettings(settings: AgendaSettings): Promise<void> {
    try {
      storage.save('lunari_agenda_settings', settings);
    } catch (error) {
      throw error;
    }
  }
}