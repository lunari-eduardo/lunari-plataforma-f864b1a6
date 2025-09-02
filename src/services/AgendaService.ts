// Serviço centralizado para lógica de negócios da agenda
import { AgendaStorageAdapter } from '@/adapters/AgendaStorageAdapter';
import { LocalStorageAgendaAdapter } from '@/adapters/LocalStorageAgendaAdapter';
import { Appointment } from '@/hooks/useAgenda';
import { AvailabilitySlot, AvailabilityType } from '@/types/availability';
import { AgendaSettings } from '@/types/agenda-supabase';
import { toast } from '@/hooks/use-toast';
import { format, isSameDay, isAfter, isBefore } from 'date-fns';

export class AgendaService {
  private adapter: AgendaStorageAdapter;

  constructor(adapter?: AgendaStorageAdapter) {
    this.adapter = adapter || new LocalStorageAgendaAdapter();
  }

  // Appointments
  async getAppointments(filters?: { 
    startDate?: Date; 
    endDate?: Date; 
    status?: string; 
    client?: string;
  }): Promise<Appointment[]> {
    return this.adapter.getAppointments(filters);
  }

  async createAppointment(appointmentData: Omit<Appointment, 'id'>): Promise<Appointment> {
    // Validação de conflitos
    await this.validateAppointmentConflicts(appointmentData);
    
    // Criar agendamento
    const appointment = await this.adapter.createAppointment(appointmentData);
    
    toast({
      title: "Agendamento criado",
      description: `Agendamento de ${appointment.client} criado com sucesso.`,
    });
    
    return appointment;
  }

  async updateAppointment(id: string, updates: Partial<Appointment>): Promise<Appointment> {
    // Validação de conflitos se mudando data/hora
    if (updates.date || updates.time) {
      const existing = await this.getAppointments();
      const current = existing.find(apt => apt.id === id);
      
      if (current) {
        const updatedAppointment = { ...current, ...updates };
        await this.validateAppointmentConflicts(updatedAppointment, id);
      }
    }
    
    const appointment = await this.adapter.updateAppointment(id, updates);
    
    toast({
      title: "Agendamento atualizado",
      description: `Agendamento de ${appointment.client} atualizado com sucesso.`,
    });
    
    return appointment;
  }

  async deleteAppointment(id: string): Promise<void> {
    await this.adapter.deleteAppointment(id);
    
    toast({
      title: "Agendamento removido",
      description: "Agendamento removido com sucesso.",
    });
  }

  // Availability
  async getAvailabilitySlots(filters?: {
    startDate?: Date;
    endDate?: Date;
    typeId?: string;
  }): Promise<AvailabilitySlot[]> {
    return this.adapter.getAvailabilitySlots(filters);
  }

  async createAvailabilitySlots(slots: Omit<AvailabilitySlot, 'id'>[]): Promise<AvailabilitySlot[]> {
    // Validar que não há slots duplicados
    const existing = await this.getAvailabilitySlots();
    const conflicts = [];
    
    for (const slot of slots) {
      const conflict = existing.find(existing => 
        existing.date === slot.date && 
        existing.time === slot.time
      );
      if (conflict) {
        conflicts.push(`${slot.date} às ${slot.time}`);
      }
    }
    
    if (conflicts.length > 0) {
      throw new Error(`Disponibilidades já existem para: ${conflicts.join(', ')}`);
    }
    
    const created = await this.adapter.createAvailabilitySlots(slots);
    
    toast({
      title: "Disponibilidades criadas",
      description: `${created.length} disponibilidade(s) criada(s) com sucesso.`,
    });
    
    return created;
  }

  async deleteAvailabilitySlot(id: string): Promise<void> {
    await this.adapter.deleteAvailabilitySlot(id);
  }

  async clearAvailabilityForDate(date: string): Promise<void> {
    await this.adapter.clearAvailabilityForDate(date);
    
    toast({
      title: "Disponibilidades removidas",
      description: `Todas as disponibilidades do dia ${date} foram removidas.`,
    });
  }

  // Availability Types
  async getAvailabilityTypes(): Promise<AvailabilityType[]> {
    return this.adapter.getAvailabilityTypes();
  }

  async createAvailabilityType(type: Omit<AvailabilityType, 'id'>): Promise<AvailabilityType> {
    return this.adapter.createAvailabilityType(type);
  }

  async updateAvailabilityType(id: string, updates: Partial<AvailabilityType>): Promise<AvailabilityType> {
    return this.adapter.updateAvailabilityType(id, updates);
  }

  async deleteAvailabilityType(id: string): Promise<void> {
    await this.adapter.deleteAvailabilityType(id);
  }

  // Settings
  async getAgendaSettings(): Promise<AgendaSettings> {
    return this.adapter.getAgendaSettings();
  }

  async updateAgendaSettings(settings: Partial<AgendaSettings>): Promise<AgendaSettings> {
    return this.adapter.updateAgendaSettings(settings);
  }

  // Business Logic
  private async validateAppointmentConflicts(
    appointment: Omit<Appointment, 'id'> & { id?: string }, 
    excludeId?: string
  ): Promise<void> {
    const existing = await this.getAppointments();
    
    const conflicts = existing.filter(existing => {
      // Não comparar consigo mesmo
      if (excludeId && existing.id === excludeId) return false;
      
      // Verificar se é no mesmo dia e horário
      if (isSameDay(existing.date, appointment.date) && existing.time === appointment.time) {
        // Se ambos são confirmados, é conflito
        if (existing.status === 'confirmado' && appointment.status === 'confirmado') {
          return true;
        }
      }
      
      return false;
    });

    if (conflicts.length > 0) {
      const conflictMsg = conflicts
        .map(c => `${c.client} (${c.status})`)
        .join(', ');
      
      throw new Error(`Conflito detectado: já existe agendamento confirmado neste horário com ${conflictMsg}`);
    }
  }

  // Utility methods
  async getAppointmentsForDate(date: Date): Promise<Appointment[]> {
    const all = await this.getAppointments();
    return all.filter(appointment => isSameDay(appointment.date, date));
  }

  async getAppointmentsForDateRange(startDate: Date, endDate: Date): Promise<Appointment[]> {
    return this.getAppointments({
      startDate,
      endDate
    });
  }

  async getAvailabilityForDate(date: Date): Promise<AvailabilitySlot[]> {
    const dateString = format(date, 'yyyy-MM-dd');
    const all = await this.getAvailabilitySlots();
    return all.filter(slot => slot.date === dateString);
  }

  // Event listeners
  onAppointmentsChange(callback: (appointments: Appointment[]) => void): () => void {
    return this.adapter.onAppointmentsChange(callback);
  }

  onAvailabilityChange(callback: (availability: AvailabilitySlot[]) => void): () => void {
    return this.adapter.onAvailabilityChange(callback);
  }

  // Para migração futura
  async migrateToSupabase(supabaseAdapter: AgendaStorageAdapter): Promise<void> {
    // Obter todos os dados do adapter atual
    const [appointments, availability, types, settings] = await Promise.all([
      this.getAppointments(),
      this.getAvailabilitySlots(),
      this.getAvailabilityTypes(),
      this.getAgendaSettings()
    ]);

    // Migrar para Supabase
    for (const appointment of appointments) {
      const { id, ...data } = appointment;
      await supabaseAdapter.createAppointment(data);
    }

    for (const slot of availability) {
      const { id, ...data } = slot;
      await supabaseAdapter.createAvailabilitySlots([data]);
    }

    for (const type of types) {
      const { id, ...data } = type;
      await supabaseAdapter.createAvailabilityType(data);
    }

    await supabaseAdapter.updateAgendaSettings(settings);

    toast({
      title: "Migração concluída",
      description: "Todos os dados da agenda foram migrados para o Supabase.",
    });
  }
}