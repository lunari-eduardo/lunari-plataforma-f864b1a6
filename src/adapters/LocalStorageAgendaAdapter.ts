import { AgendaStorageAdapter, AppointmentFilters, AvailabilityFilters } from './AgendaStorageAdapter';
import { Appointment } from '@/hooks/useAgenda';
import { AvailabilitySlot, AvailabilityType } from '@/types/availability';
import { AgendaSettings } from '@/types/agenda-supabase';
import { storage, STORAGE_KEYS } from '@/utils/localStorage';
import { formatDateForStorage, parseDateFromStorage } from '@/utils/dateUtils';

// Implementação LocalStorage para manter compatibilidade atual
export class LocalStorageAgendaAdapter extends AgendaStorageAdapter {
  private listeners: Map<string, ((data: any) => void)[]> = new Map();

  constructor() {
    super();
    // Inicializar listeners
    this.listeners.set('appointments', []);
    this.listeners.set('availability', []);
  }

  // Appointments
  async getAppointments(filters?: AppointmentFilters): Promise<Appointment[]> {
    const appointments = storage.load(STORAGE_KEYS.APPOINTMENTS, []);
    
    if (!filters) return appointments;
    
    return appointments.filter((apt: Appointment) => {
      if (filters.startDate && apt.date < filters.startDate) return false;
      if (filters.endDate && apt.date > filters.endDate) return false;
      if (filters.status && apt.status !== filters.status) return false;
      if (filters.client && !apt.client.toLowerCase().includes(filters.client.toLowerCase())) return false;
      return true;
    });
  }

  async createAppointment(appointment: Omit<Appointment, 'id'>): Promise<Appointment> {
    const appointments = await this.getAppointments();
    const newAppointment: Appointment = {
      ...appointment,
      id: this.generateId()
    };
    
    const updated = [...appointments, newAppointment];
    storage.save(STORAGE_KEYS.APPOINTMENTS, updated);
    this.notifyListeners('appointments', updated);
    
    return newAppointment;
  }

  async updateAppointment(id: string, updates: Partial<Appointment>): Promise<Appointment> {
    const appointments = await this.getAppointments();
    const index = appointments.findIndex(apt => apt.id === id);
    
    if (index === -1) {
      throw new Error(`Appointment with id ${id} not found`);
    }
    
    appointments[index] = { ...appointments[index], ...updates };
    storage.save(STORAGE_KEYS.APPOINTMENTS, appointments);
    this.notifyListeners('appointments', appointments);
    
    return appointments[index];
  }

  async deleteAppointment(id: string): Promise<void> {
    const appointments = await this.getAppointments();
    const filtered = appointments.filter(apt => apt.id !== id);
    
    storage.save(STORAGE_KEYS.APPOINTMENTS, filtered);
    this.notifyListeners('appointments', filtered);
  }

  // Availability Slots
  async getAvailabilitySlots(filters?: AvailabilityFilters): Promise<AvailabilitySlot[]> {
    const slots = storage.load(STORAGE_KEYS.AVAILABILITY, []);
    
    if (!filters) return slots;
    
    return slots.filter((slot: AvailabilitySlot) => {
      if (filters.startDate) {
        const slotDate = parseDateFromStorage(slot.date);
        if (slotDate < filters.startDate) return false;
      }
      if (filters.endDate) {
        const slotDate = parseDateFromStorage(slot.date);
        if (slotDate > filters.endDate) return false;
      }
      if (filters.typeId && slot.typeId !== filters.typeId) return false;
      return true;
    });
  }

  async createAvailabilitySlots(slots: Omit<AvailabilitySlot, 'id'>[]): Promise<AvailabilitySlot[]> {
    const existing = await this.getAvailabilitySlots();
    const newSlots = slots.map(slot => ({
      ...slot,
      id: this.generateId()
    }));
    
    const updated = [...existing, ...newSlots];
    storage.save(STORAGE_KEYS.AVAILABILITY, updated);
    this.notifyListeners('availability', updated);
    
    return newSlots;
  }

  async deleteAvailabilitySlot(id: string): Promise<void> {
    const slots = await this.getAvailabilitySlots();
    const filtered = slots.filter(slot => slot.id !== id);
    
    storage.save(STORAGE_KEYS.AVAILABILITY, filtered);
    this.notifyListeners('availability', filtered);
  }

  async clearAvailabilityForDate(date: string): Promise<void> {
    const slots = await this.getAvailabilitySlots();
    const filtered = slots.filter(slot => slot.date !== date);
    
    storage.save(STORAGE_KEYS.AVAILABILITY, filtered);
    this.notifyListeners('availability', filtered);
  }

  // Availability Types
  async getAvailabilityTypes(): Promise<AvailabilityType[]> {
    return storage.load(STORAGE_KEYS.AVAILABILITY_TYPES, []);
  }

  async createAvailabilityType(type: Omit<AvailabilityType, 'id'>): Promise<AvailabilityType> {
    const types = await this.getAvailabilityTypes();
    const newType: AvailabilityType = {
      ...type,
      id: this.generateId()
    };
    
    const updated = [...types, newType];
    storage.save(STORAGE_KEYS.AVAILABILITY_TYPES, updated);
    
    return newType;
  }

  async updateAvailabilityType(id: string, updates: Partial<AvailabilityType>): Promise<AvailabilityType> {
    const types = await this.getAvailabilityTypes();
    const index = types.findIndex(type => type.id === id);
    
    if (index === -1) {
      throw new Error(`Availability type with id ${id} not found`);
    }
    
    types[index] = { ...types[index], ...updates };
    storage.save(STORAGE_KEYS.AVAILABILITY_TYPES, types);
    
    return types[index];
  }

  async deleteAvailabilityType(id: string): Promise<void> {
    const types = await this.getAvailabilityTypes();
    const filtered = types.filter(type => type.id !== id);
    
    storage.save(STORAGE_KEYS.AVAILABILITY_TYPES, filtered);
  }

  // Settings
  async getAgendaSettings(): Promise<AgendaSettings> {
    return storage.load('agendaSettings', {
      preferredView: 'month',
      timeSlots: ['09:00', '10:00', '11:00', '14:00', '15:00', '16:00', '17:00'],
      workingDays: [1, 2, 3, 4, 5], // Segunda a sexta
      workingHours: { start: '09:00', end: '18:00' },
      conflictResolution: 'warn'
    });
  }

  async updateAgendaSettings(settings: Partial<AgendaSettings>): Promise<AgendaSettings> {
    const current = await this.getAgendaSettings();
    const updated = { ...current, ...settings };
    
    storage.save('agendaSettings', updated);
    
    return updated;
  }

  // Event listeners
  onAppointmentsChange(callback: (appointments: Appointment[]) => void): () => void {
    const listeners = this.listeners.get('appointments') || [];
    listeners.push(callback);
    this.listeners.set('appointments', listeners);
    
    // Return unsubscribe function
    return () => {
      const currentListeners = this.listeners.get('appointments') || [];
      const index = currentListeners.indexOf(callback);
      if (index > -1) {
        currentListeners.splice(index, 1);
      }
    };
  }

  onAvailabilityChange(callback: (availability: AvailabilitySlot[]) => void): () => void {
    const listeners = this.listeners.get('availability') || [];
    listeners.push(callback);
    this.listeners.set('availability', listeners);
    
    return () => {
      const currentListeners = this.listeners.get('availability') || [];
      const index = currentListeners.indexOf(callback);
      if (index > -1) {
        currentListeners.splice(index, 1);
      }
    };
  }

  private notifyListeners(type: string, data: any): void {
    const listeners = this.listeners.get(type) || [];
    listeners.forEach(callback => callback(data));
  }
}