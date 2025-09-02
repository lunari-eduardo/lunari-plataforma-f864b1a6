import { AgendaStorageAdapter } from './AgendaStorageAdapter';
import { Appointment } from '@/hooks/useAgenda';
import { AvailabilitySlot, AvailabilityType } from '@/types/availability';
import { AgendaSettings } from '@/types/agenda-supabase';

/**
 * Local Storage implementation of AgendaStorageAdapter
 * Preserves existing localStorage functionality
 */
export class LocalStorageAgendaAdapter extends AgendaStorageAdapter {
  private readonly APPOINTMENTS_KEY = 'lunari_appointments';
  private readonly AVAILABILITY_KEY = 'lunari_availability';
  private readonly AVAILABILITY_TYPES_KEY = 'lunari_availability_types';
  private readonly SETTINGS_KEY = 'lunari_agenda_settings';

  // Appointments
  async loadAppointments(): Promise<Appointment[]> {
    try {
      const stored = localStorage.getItem(this.APPOINTMENTS_KEY);
      if (!stored) return [];
      
      const appointments = JSON.parse(stored);
      return appointments.map((app: any) => ({
        ...app,
        date: new Date(app.date),
      }));
    } catch (error) {
      console.error('❌ Erro ao carregar appointments:', error);
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
      localStorage.setItem(this.APPOINTMENTS_KEY, JSON.stringify(appointments));
      return newAppointment;
    } catch (error) {
      console.error('❌ Erro ao salvar appointment:', error);
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
        localStorage.setItem(this.APPOINTMENTS_KEY, JSON.stringify(appointments));
      }
    } catch (error) {
      console.error('❌ Erro ao atualizar appointment:', error);
      throw error;
    }
  }

  async deleteAppointment(id: string): Promise<void> {
    try {
      const appointments = await this.loadAppointments();
      const filtered = appointments.filter(app => app.id !== id);
      localStorage.setItem(this.APPOINTMENTS_KEY, JSON.stringify(filtered));
    } catch (error) {
      console.error('❌ Erro ao deletar appointment:', error);
      throw error;
    }
  }

  // Availability
  async loadAvailabilitySlots(): Promise<AvailabilitySlot[]> {
    try {
      const stored = localStorage.getItem(this.AVAILABILITY_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('❌ Erro ao carregar availability slots:', error);
      return [];
    }
  }

  async saveAvailabilitySlots(slots: AvailabilitySlot[]): Promise<void> {
    try {
      localStorage.setItem(this.AVAILABILITY_KEY, JSON.stringify(slots));
    } catch (error) {
      console.error('❌ Erro ao salvar availability slots:', error);
      throw error;
    }
  }

  async deleteAvailabilitySlot(id: string): Promise<void> {
    try {
      const slots = await this.loadAvailabilitySlots();
      const filtered = slots.filter(slot => slot.id !== id);
      await this.saveAvailabilitySlots(filtered);
    } catch (error) {
      console.error('❌ Erro ao deletar availability slot:', error);
      throw error;
    }
  }

  async clearAvailabilityForDate(date: string): Promise<void> {
    try {
      const slots = await this.loadAvailabilitySlots();
      const filtered = slots.filter(slot => slot.date !== date);
      await this.saveAvailabilitySlots(filtered);
    } catch (error) {
      console.error('❌ Erro ao limpar availability para data:', error);
      throw error;
    }
  }

  // Availability Types
  async loadAvailabilityTypes(): Promise<AvailabilityType[]> {
    try {
      const stored = localStorage.getItem(this.AVAILABILITY_TYPES_KEY);
      return stored ? JSON.parse(stored) : [
        { id: '1', name: 'Ensaio Gestante', duration: 120, color: '#10b981' },
        { id: '2', name: 'Ensaio Família', duration: 90, color: '#3b82f6' },
        { id: '3', name: 'Ensaio Corporativo', duration: 60, color: '#8b5cf6' },
        { id: '4', name: 'Reunião Cliente', duration: 30, color: '#f59e0b' }
      ];
    } catch (error) {
      console.error('❌ Erro ao carregar availability types:', error);
      return [];
    }
  }

  async saveAvailabilityType(type: AvailabilityType): Promise<AvailabilityType> {
    try {
      const types = await this.loadAvailabilityTypes();
      const newType = { ...type, id: type.id || this.generateId() };
      types.push(newType);
      localStorage.setItem(this.AVAILABILITY_TYPES_KEY, JSON.stringify(types));
      return newType;
    } catch (error) {
      console.error('❌ Erro ao salvar availability type:', error);
      throw error;
    }
  }

  async updateAvailabilityType(id: string, updates: Partial<AvailabilityType>): Promise<void> {
    try {
      const types = await this.loadAvailabilityTypes();
      const index = types.findIndex(type => type.id === id);
      
      if (index !== -1) {
        types[index] = { ...types[index], ...updates };
        localStorage.setItem(this.AVAILABILITY_TYPES_KEY, JSON.stringify(types));
      }
    } catch (error) {
      console.error('❌ Erro ao atualizar availability type:', error);
      throw error;
    }
  }

  async deleteAvailabilityType(id: string): Promise<void> {
    try {
      const types = await this.loadAvailabilityTypes();
      const filtered = types.filter(type => type.id !== id);
      localStorage.setItem(this.AVAILABILITY_TYPES_KEY, JSON.stringify(filtered));
    } catch (error) {
      console.error('❌ Erro ao deletar availability type:', error);
      throw error;
    }
  }

  // Settings
  async loadSettings(): Promise<AgendaSettings> {
    try {
      const stored = localStorage.getItem(this.SETTINGS_KEY);
      return stored ? JSON.parse(stored) : {
        defaultView: 'weekly',
        workingHours: { start: '08:00', end: '18:00' },
        autoConfirmAppointments: false
      };
    } catch (error) {
      console.error('❌ Erro ao carregar settings:', error);
      return {
        defaultView: 'weekly',
        workingHours: { start: '08:00', end: '18:00' },
        autoConfirmAppointments: false
      };
    }
  }

  async saveSettings(settings: AgendaSettings): Promise<void> {
    try {
      localStorage.setItem(this.SETTINGS_KEY, JSON.stringify(settings));
    } catch (error) {
      console.error('❌ Erro ao salvar settings:', error);
      throw error;
    }
  }
}