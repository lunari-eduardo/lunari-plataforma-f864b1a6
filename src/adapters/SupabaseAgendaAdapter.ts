import { AgendaStorageAdapter } from './AgendaStorageAdapter';
import { Appointment } from '@/hooks/useAgenda';
import { AvailabilitySlot, AvailabilityType } from '@/types/availability';
import { AgendaSettings } from '@/types/agenda-supabase';
import { supabase } from '@/integrations/supabase/client';
import { generateUniversalSessionId } from '@/types/appointments-supabase';

/**
 * Supabase implementation for agenda data persistence
 * Real-time enabled with full CRUD operations
 * 
 * IMPORTANTE - PARSING DE DATAS:
 * - SEMPRE usar this.parseDateFromStorage() para converter string → Date
 * - NUNCA usar new Date(string) pois causa bugs de timezone
 * - this.parseDateFromStorage() garante Date em timezone LOCAL
 */
export class SupabaseAgendaAdapter extends AgendaStorageAdapter {
  constructor() {
    super();
    console.log('✅ SupabaseAgendaAdapter initialized - Supabase integration active');
  }

  // Appointments
  async loadAppointments(): Promise<Appointment[]> {
    const { data: user } = await supabase.auth.getUser();
    if (!user?.user) throw new Error('User not authenticated');

    const { data, error } = await supabase
      .from('appointments')
      .select('*')
      .eq('user_id', user.user.id)
      .order('date', { ascending: false })
      .order('time', { ascending: true });

    if (error) throw error;

    return data.map(appointment => ({
      id: appointment.id,
      sessionId: appointment.session_id,
      title: appointment.title,
      date: this.parseDateFromStorage(appointment.date),
      time: appointment.time,
      type: appointment.type,
      client: appointment.title, // Using title as client name
      status: appointment.status as any,
      description: appointment.description || '',
      packageId: appointment.package_id || '',
      paidAmount: Number(appointment.paid_amount) || 0,
      email: '',
      whatsapp: '',
      orcamentoId: appointment.orcamento_id || '',
      origem: appointment.origem as any,
      clienteId: appointment.cliente_id || ''
    }));
  }

  async saveAppointment(appointment: Appointment): Promise<Appointment> {
    const { data: user } = await supabase.auth.getUser();
    if (!user?.user) throw new Error('User not authenticated');

    const sessionId = appointment.sessionId || generateUniversalSessionId('agenda');

    const { data, error } = await supabase
      .from('appointments')
      .insert({
        user_id: user.user.id,
        session_id: sessionId,
        title: appointment.title,
        date: this.formatDateForStorage(appointment.date),
        time: appointment.time,
        type: appointment.type,
        status: appointment.status,
        description: appointment.description,
        package_id: appointment.packageId,
        paid_amount: appointment.paidAmount || 0,
        orcamento_id: appointment.orcamentoId,
        origem: appointment.origem || 'agenda',
        cliente_id: appointment.clienteId
      })
      .select()
      .single();

    if (error) throw error;

    return {
      ...appointment,
      id: data.id,
      sessionId: data.session_id
    };
  }

  async updateAppointment(id: string, updates: Partial<Appointment>): Promise<void> {
    const { data: user } = await supabase.auth.getUser();
    if (!user?.user) throw new Error('User not authenticated');

    const updateData: any = {};
    
    if (updates.title) updateData.title = updates.title;
    if (updates.date) updateData.date = this.formatDateForStorage(updates.date);
    if (updates.time) updateData.time = updates.time;
    if (updates.type) updateData.type = updates.type;
    if (updates.status) updateData.status = updates.status;
    if (updates.description !== undefined) updateData.description = updates.description;
    if (updates.packageId !== undefined) updateData.package_id = updates.packageId;
    if (updates.paidAmount !== undefined) updateData.paid_amount = updates.paidAmount;
    if (updates.orcamentoId !== undefined) updateData.orcamento_id = updates.orcamentoId;
    if (updates.origem) updateData.origem = updates.origem;
    if (updates.clienteId !== undefined) updateData.cliente_id = updates.clienteId;

    const { error } = await supabase
      .from('appointments')
      .update(updateData)
      .eq('id', id)
      .eq('user_id', user.user.id);

    if (error) throw error;
  }

  async deleteAppointment(id: string, preservePayments?: boolean): Promise<void> {
    const { data: user } = await supabase.auth.getUser();
    if (!user?.user) throw new Error('User not authenticated');

    // FASE 3: Validar parâmetro
    console.log(`🔍 [DeleteAppointment] preservePayments = ${preservePayments} (${typeof preservePayments})`);
    
    if (preservePayments !== undefined && typeof preservePayments !== 'boolean') {
      console.error('❌ Parâmetro preservePayments inválido:', preservePayments);
      throw new Error('preservePayments deve ser boolean (true/false)');
    }

    // First, find the appointment to get its session data
    const { data: appointment, error: appointmentError } = await supabase
      .from('appointments')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.user.id)
      .single();

    if (appointmentError || !appointment) {
      console.error('❌ Appointment not found for deletion:', appointmentError);
      throw appointmentError;
    }

    console.log('🗑️ [DeleteAppointment] Starting deletion process:', {
      appointmentId: id,
      sessionId: appointment.session_id,
      preservePayments: preservePayments ?? false
    });

    // Find related workflow session by appointment_id or session_id
    const { data: workflowSession } = await supabase
      .from('clientes_sessoes')
      .select('*')
      .eq('user_id', user.user.id)
      .or(`appointment_id.eq.${id},session_id.eq.${appointment.session_id}`)
      .maybeSingle();

    if (workflowSession) {
      // FASE 4: Log detalhado da sessão encontrada
      console.log('🔍 Sessão encontrada:', {
        id: workflowSession.id,
        session_id: workflowSession.session_id,
        appointment_id: workflowSession.appointment_id,
        status: workflowSession.status
      });
      
      // Contar pagamentos vinculados
      const { count } = await supabase
        .from('clientes_transacoes')
        .select('*', { count: 'exact', head: true })
        .eq('session_id', workflowSession.session_id)
        .eq('user_id', user.user.id);
        
      console.log(`💰 ${count || 0} pagamento(s) vinculado(s) a esta sessão`);

      if (preservePayments) {
        // FASE 2: Preserve payments with error handling
        console.log('💾 Preserving payments - unlinking appointment from session');
        
        const { data: updatedSession, error: updateError } = await supabase
          .from('clientes_sessoes')
          .update({ 
            appointment_id: null,
            status: 'cancelado',
            descricao: `${workflowSession.descricao || ''} (Agendamento cancelado)`.trim()
          })
          .eq('id', workflowSession.id)
          .select();

        if (updateError) {
          console.error('❌ Erro ao desvincular agendamento:', updateError);
          throw new Error(`Falha ao preservar sessão: ${updateError.message}`);
        }

        if (!updatedSession || updatedSession.length === 0) {
          console.warn('⚠️ Sessão não foi encontrada para desvincular');
        }

        console.log('✅ Appointment unlinked from session, payments preserved');
      } else {
        // FASE 1: Delete everything with robust error handling
        console.log('🗑️ Deleting session and all related data');
        
        // Delete transactions first (foreign key constraint)
        const { data: deletedTransactions, error: transacoesError } = await supabase
          .from('clientes_transacoes')
          .delete()
          .eq('session_id', workflowSession.session_id)
          .eq('user_id', user.user.id)
          .select();

        if (transacoesError) {
          console.error('❌ Erro ao deletar transações:', transacoesError);
          throw new Error(`Falha ao deletar pagamentos: ${transacoesError.message}`);
        }

        console.log(`🗑️ ${deletedTransactions?.length || 0} transação(ões) deletada(s)`);

        // Delete the session
        const { data: deletedSession, error: sessionError } = await supabase
          .from('clientes_sessoes')
          .delete()
          .eq('id', workflowSession.id)
          .eq('user_id', user.user.id)
          .select();

        if (sessionError) {
          console.error('❌ Erro ao deletar sessão:', sessionError);
          throw new Error(`Falha ao deletar sessão: ${sessionError.message}`);
        }

        if (!deletedSession || deletedSession.length === 0) {
          console.warn('⚠️ Sessão não foi encontrada ou já foi deletada');
        }

        console.log(`✅ Exclusão completa: ${deletedTransactions?.length || 0} pagamento(s) + 1 sessão deletados`);
      }
    } else {
      console.log('ℹ️ No related workflow session found for appointment');
    }

    // Finally, delete the appointment
    const { error } = await supabase
      .from('appointments')
      .delete()
      .eq('id', id)
      .eq('user_id', user.user.id);

    if (error) throw error;

    console.log('✅ Appointment deleted successfully');
  }

  // Availability (using localStorage for now - will migrate later if needed)
  async loadAvailabilitySlots(): Promise<AvailabilitySlot[]> {
    try {
      const saved = localStorage.getItem('agenda_availability_slots');
      return saved ? JSON.parse(saved) : [];
    } catch (error) {
      console.error('Error loading availability slots:', error);
      return [];
    }
  }

  async saveAvailabilitySlots(slots: AvailabilitySlot[]): Promise<void> {
    try {
      localStorage.setItem('agenda_availability_slots', JSON.stringify(slots));
    } catch (error) {
      console.error('Error saving availability slots:', error);
      throw error;
    }
  }

  async deleteAvailabilitySlot(id: string): Promise<void> {
    const slots = await this.loadAvailabilitySlots();
    const updatedSlots = slots.filter(slot => slot.id !== id);
    await this.saveAvailabilitySlots(updatedSlots);
  }

  async clearAvailabilityForDate(date: string): Promise<void> {
    const slots = await this.loadAvailabilitySlots();
    const updatedSlots = slots.filter(slot => slot.date !== date);
    await this.saveAvailabilitySlots(updatedSlots);
  }

  // Availability Types
  async loadAvailabilityTypes(): Promise<AvailabilityType[]> {
    try {
      const saved = localStorage.getItem('agenda_availability_types');
      const types = saved ? JSON.parse(saved) : [];
      
      // Return defaults if empty
      if (types.length === 0) {
        return [
          {
            id: '1',
            name: 'Disponível',
            color: '#10b981'
          },
          {
            id: '2', 
            name: 'Ocupado',
            color: '#ef4444'
          }
        ];
      }
      
      return types;
    } catch (error) {
      console.error('Error loading availability types:', error);
      return [];
    }
  }

  async saveAvailabilityType(type: AvailabilityType): Promise<AvailabilityType> {
    const types = await this.loadAvailabilityTypes();
    const newType = { ...type, id: type.id || this.generateId() };
    const updatedTypes = [...types, newType];
    
    try {
      localStorage.setItem('agenda_availability_types', JSON.stringify(updatedTypes));
      return newType;
    } catch (error) {
      console.error('Error saving availability type:', error);
      throw error;
    }
  }

  async updateAvailabilityType(id: string, updates: Partial<AvailabilityType>): Promise<void> {
    const types = await this.loadAvailabilityTypes();
    const updatedTypes = types.map(type => 
      type.id === id ? { ...type, ...updates } : type
    );
    
    try {
      localStorage.setItem('agenda_availability_types', JSON.stringify(updatedTypes));
    } catch (error) {
      console.error('Error updating availability type:', error);
      throw error;
    }
  }

  async deleteAvailabilityType(id: string): Promise<void> {
    const types = await this.loadAvailabilityTypes();
    const updatedTypes = types.filter(type => type.id !== id);
    
    try {
      localStorage.setItem('agenda_availability_types', JSON.stringify(updatedTypes));
    } catch (error) {
      console.error('Error deleting availability type:', error);
      throw error;
    }
  }

  // Settings
  async loadSettings(): Promise<AgendaSettings> {
    try {
      const saved = localStorage.getItem('agenda_settings');
      return saved ? JSON.parse(saved) : {
        defaultView: 'weekly',
        workingHours: { start: '08:00', end: '18:00' },
        autoConfirmAppointments: false
      };
    } catch (error) {
      console.error('Error loading settings:', error);
      return {
        defaultView: 'weekly',
        workingHours: { start: '08:00', end: '18:00' },
        autoConfirmAppointments: false
      };
    }
  }

  async saveSettings(settings: AgendaSettings): Promise<void> {
    try {
      localStorage.setItem('agenda_settings', JSON.stringify(settings));
    } catch (error) {
      console.error('Error saving settings:', error);
      throw error;
    }
  }
}