import { AgendaStorageAdapter, AppointmentFilters, AvailabilityFilters } from './AgendaStorageAdapter';
import { Appointment } from '@/hooks/useAgenda';
import { AvailabilitySlot, AvailabilityType } from '@/types/availability';
import { AgendaSettings, AgendaTypeMapper } from '@/types/agenda-supabase';

// Implementação Supabase (stub para migração futura)
export class SupabaseAgendaAdapter extends AgendaStorageAdapter {
  constructor(private supabaseClient: any) {
    super();
  }

  // Appointments
  async getAppointments(filters?: AppointmentFilters): Promise<Appointment[]> {
    // TODO: Implementar quando Supabase estiver conectado
    let query = this.supabaseClient.from('appointments').select('*');
    
    if (filters?.startDate) {
      query = query.gte('date', filters.startDate.toISOString().split('T')[0]);
    }
    if (filters?.endDate) {
      query = query.lte('date', filters.endDate.toISOString().split('T')[0]);
    }
    if (filters?.status) {
      query = query.eq('status', filters.status);
    }
    if (filters?.client) {
      query = query.ilike('client', `%${filters.client}%`);
    }

    const { data, error } = await query.order('date', { ascending: true });
    
    if (error) throw new Error(error.message);
    
    return data?.map(AgendaTypeMapper.appointmentFromSupabase) || [];
  }

  async createAppointment(appointment: Omit<Appointment, 'id'>): Promise<Appointment> {
    const supabaseAppointment = AgendaTypeMapper.appointmentToSupabase({ ...appointment, id: '' });
    delete (supabaseAppointment as any).id; // Remove id temporário
    
    const { data, error } = await this.supabaseClient
      .from('appointments')
      .insert(supabaseAppointment)
      .select()
      .single();
      
    if (error) throw new Error(error.message);
    
    return AgendaTypeMapper.appointmentFromSupabase(data);
  }

  async updateAppointment(id: string, updates: Partial<Appointment>): Promise<Appointment> {
    const supabaseUpdates = AgendaTypeMapper.appointmentToSupabase({ ...updates, id });
    delete (supabaseUpdates as any).id;
    
    const { data, error } = await this.supabaseClient
      .from('appointments')
      .update(supabaseUpdates)
      .eq('id', id)
      .select()
      .single();
      
    if (error) throw new Error(error.message);
    
    return AgendaTypeMapper.appointmentFromSupabase(data);
  }

  async deleteAppointment(id: string): Promise<void> {
    const { error } = await this.supabaseClient
      .from('appointments')
      .delete()
      .eq('id', id);
      
    if (error) throw new Error(error.message);
  }

  // Availability Slots
  async getAvailabilitySlots(filters?: AvailabilityFilters): Promise<AvailabilitySlot[]> {
    let query = this.supabaseClient.from('availability_slots').select('*');
    
    if (filters?.startDate) {
      query = query.gte('date', filters.startDate.toISOString().split('T')[0]);
    }
    if (filters?.endDate) {
      query = query.lte('date', filters.endDate.toISOString().split('T')[0]);
    }
    if (filters?.typeId) {
      query = query.eq('type_id', filters.typeId);
    }

    const { data, error } = await query.order('date', { ascending: true });
    
    if (error) throw new Error(error.message);
    
    return data?.map((slot: any) => ({
      id: slot.id,
      date: slot.date,
      time: slot.time,
      duration: slot.duration || 60,
      typeId: slot.type_id,
      label: slot.label,
      color: slot.color
    })) || [];
  }

  async createAvailabilitySlots(slots: Omit<AvailabilitySlot, 'id'>[]): Promise<AvailabilitySlot[]> {
    const supabaseSlots = slots.map(slot => ({
      date: slot.date,
      time: slot.time,
      duration: slot.duration,
      type_id: slot.typeId,
      label: slot.label,
      color: slot.color
    }));
    
    const { data, error } = await this.supabaseClient
      .from('availability_slots')
      .insert(supabaseSlots)
      .select();
      
    if (error) throw new Error(error.message);
    
    return data?.map((slot: any) => ({
      id: slot.id,
      date: slot.date,
      time: slot.time,
      duration: slot.duration || 60,
      typeId: slot.type_id,
      label: slot.label,
      color: slot.color
    })) || [];
  }

  async deleteAvailabilitySlot(id: string): Promise<void> {
    const { error } = await this.supabaseClient
      .from('availability_slots')
      .delete()
      .eq('id', id);
      
    if (error) throw new Error(error.message);
  }

  async clearAvailabilityForDate(date: string): Promise<void> {
    const { error } = await this.supabaseClient
      .from('availability_slots')
      .delete()
      .eq('date', date);
      
    if (error) throw new Error(error.message);
  }

  // Availability Types
  async getAvailabilityTypes(): Promise<AvailabilityType[]> {
    const { data, error } = await this.supabaseClient
      .from('availability_types')
      .select('*')
      .order('name', { ascending: true });
    
    if (error) throw new Error(error.message);
    
    return data?.map((type: any) => ({
      id: type.id,
      name: type.name,
      color: type.color
    })) || [];
  }

  async createAvailabilityType(type: Omit<AvailabilityType, 'id'>): Promise<AvailabilityType> {
    const { data, error } = await this.supabaseClient
      .from('availability_types')
      .insert({
        name: type.name,
        color: type.color
      })
      .select()
      .single();
      
    if (error) throw new Error(error.message);
    
    return {
      id: data.id,
      name: data.name,
      color: data.color
    };
  }

  async updateAvailabilityType(id: string, updates: Partial<AvailabilityType>): Promise<AvailabilityType> {
    const { data, error } = await this.supabaseClient
      .from('availability_types')
      .update({
        ...(updates.name && { name: updates.name }),
        ...(updates.color && { color: updates.color })
      })
      .eq('id', id)
      .select()
      .single();
      
    if (error) throw new Error(error.message);
    
    return {
      id: data.id,
      name: data.name,
      color: data.color
    };
  }

  async deleteAvailabilityType(id: string): Promise<void> {
    const { error } = await this.supabaseClient
      .from('availability_types')
      .delete()
      .eq('id', id);
      
    if (error) throw new Error(error.message);
  }

  // Settings
  async getAgendaSettings(): Promise<AgendaSettings> {
    const { data, error } = await this.supabaseClient
      .from('user_settings')
      .select('agenda_settings')
      .single();
      
    if (error && error.code !== 'PGRST116') { // Não encontrado
      throw new Error(error.message);
    }
    
    return data?.agenda_settings || {
      preferredView: 'month',
      timeSlots: ['09:00', '10:00', '11:00', '14:00', '15:00', '16:00', '17:00'],
      workingDays: [1, 2, 3, 4, 5],
      workingHours: { start: '09:00', end: '18:00' },
      conflictResolution: 'warn'
    };
  }

  async updateAgendaSettings(settings: Partial<AgendaSettings>): Promise<AgendaSettings> {
    const current = await this.getAgendaSettings();
    const updated = { ...current, ...settings };
    
    const { error } = await this.supabaseClient
      .from('user_settings')
      .upsert({ agenda_settings: updated });
      
    if (error) throw new Error(error.message);
    
    return updated;
  }

  // Event listeners usando real-time subscriptions
  onAppointmentsChange(callback: (appointments: Appointment[]) => void): () => void {
    const subscription = this.supabaseClient
      .channel('appointments-changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'appointments' },
        async () => {
          const appointments = await this.getAppointments();
          callback(appointments);
        }
      )
      .subscribe();

    return () => {
      this.supabaseClient.removeChannel(subscription);
    };
  }

  onAvailabilityChange(callback: (availability: AvailabilitySlot[]) => void): () => void {
    const subscription = this.supabaseClient
      .channel('availability-changes')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'availability_slots' },
        async () => {
          const availability = await this.getAvailabilitySlots();
          callback(availability);
        }
      )
      .subscribe();

    return () => {
      this.supabaseClient.removeChannel(subscription);
    };
  }
}