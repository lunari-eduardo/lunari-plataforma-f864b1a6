import { AgendaStorageAdapter } from './AgendaStorageAdapter';
import { Appointment } from '@/hooks/useAgenda';
import { AvailabilitySlot, AvailabilityType } from '@/types/availability';
import { AgendaSettings } from '@/types/agenda-supabase';
import { supabase } from '@/integrations/supabase/client';
import { generateUniversalSessionId } from '@/types/appointments-supabase';
import { formatCurrency } from '@/utils/financialUtils';

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

    // ✅ FASE 1: Validar e preparar data
    const dateStr = typeof appointment.date === 'string' 
      ? appointment.date 
      : this.formatDateForStorage(appointment.date);
    
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      console.error('❌ Invalid date format:', dateStr);
      throw new Error('Data inválida. Use formato YYYY-MM-DD');
    }

    console.log(`📅 [${new Date().toISOString()}] Saving appointment with date:`, dateStr);

    const { data, error } = await supabase
      .from('appointments')
      .insert({
        user_id: user.user.id,
        session_id: sessionId,
        title: appointment.title,
        date: dateStr,
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

    const converted = {
      ...appointment,
      id: data.id,
      sessionId: data.session_id
    };
    
    // FASE 1: Criar sessão imediatamente se confirmado (idempotente)
    if (converted.status === 'confirmado') {
      try {
        console.log('✅ [SupabaseAdapter] Appointment confirmado, criando sessão imediatamente:', converted.id);
        const { WorkflowSupabaseService } = await import('@/services/WorkflowSupabaseService');
        const session = await WorkflowSupabaseService.createSessionFromAppointment(converted.id, converted);
        
        if (session) {
          console.log('🎯 [SupabaseAdapter] Sessão criada com sucesso:', session.id);
          window.dispatchEvent(new CustomEvent('workflow-session-created', {
            detail: { sessionId: session.id, appointmentId: converted.id, timestamp: new Date().toISOString() }
          }));
        }
      } catch (sessionError) {
        console.error('⚠️ [SupabaseAdapter] Erro ao criar sessão (não fatal):', sessionError);
      }
    }

    return converted;
  }

  async updateAppointment(id: string, updates: Partial<Appointment>): Promise<void> {
    const { data: user } = await supabase.auth.getUser();
    if (!user?.user) throw new Error('User not authenticated');

    const updateData: any = {};
    
    if (updates.title) updateData.title = updates.title;
    if (updates.date) {
      // ✅ FASE 1: Validar e preparar data
      const dateStr = typeof updates.date === 'string' 
        ? updates.date 
        : this.formatDateForStorage(updates.date);
      
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        console.error('❌ Invalid date format:', dateStr);
        throw new Error('Data inválida. Use formato YYYY-MM-DD');
      }
      
      console.log(`📅 [${new Date().toISOString()}] Updating appointment ${id} with date:`, dateStr);
      updateData.date = dateStr;
    }
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
    
    // FASE 1: Se mudou para confirmado, criar sessão imediatamente
    const wasConfirmed = updates.status === 'confirmado';
    if (wasConfirmed) {
      try {
        // Buscar dados completos do appointment
        const { data: appointmentData } = await supabase
          .from('appointments')
          .select('*')
          .eq('id', id)
          .eq('user_id', user.user.id)
          .single();
        
        if (appointmentData) {
          console.log('✅ [SupabaseAdapter] Appointment confirmado, criando sessão imediatamente:', id);
          const { WorkflowSupabaseService } = await import('@/services/WorkflowSupabaseService');
          
          // Convert to Appointment format
          const converted = {
            id: appointmentData.id,
            sessionId: appointmentData.session_id,
            title: appointmentData.title,
            date: this.parseDateFromStorage(appointmentData.date),
            time: appointmentData.time,
            type: appointmentData.type,
            client: appointmentData.title,
            status: appointmentData.status,
            description: appointmentData.description || '',
            packageId: appointmentData.package_id || '',
            paidAmount: Number(appointmentData.paid_amount) || 0,
            email: '',
            whatsapp: '',
            orcamentoId: appointmentData.orcamento_id || '',
            origem: appointmentData.origem,
            clienteId: appointmentData.cliente_id || '',
            // Add extra fields needed by WorkflowSupabaseService
            package_id: appointmentData.package_id,
            paid_amount: appointmentData.paid_amount,
            cliente_id: appointmentData.cliente_id
          };
          
          const session = await WorkflowSupabaseService.createSessionFromAppointment(id, converted);
          
          if (session) {
            console.log('🎯 [SupabaseAdapter] Sessão criada com sucesso:', session.id);
            window.dispatchEvent(new CustomEvent('workflow-session-created', {
              detail: { sessionId: session.id, appointmentId: id, timestamp: new Date().toISOString() }
            }));
          }
        }
      } catch (sessionError) {
        console.error('⚠️ [SupabaseAdapter] Erro ao criar sessão (não fatal):', sessionError);
      }
    }
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
        console.log('💾 Preserving payments - marking session as historical (payments only)');
        
        // Ler valor pago atual ANTES de zerar tudo
        const valorPagoAtual = Number(workflowSession.valor_pago) || 0;
        
        const { data: updatedSession, error: updateError } = await supabase
          .from('clientes_sessoes')
          .update({ 
            appointment_id: null,
            status: 'historico',
            
            // ✅ ZERAR TODOS OS VALORES (exceto valor_pago)
            valor_total: valorPagoAtual, // Total = apenas o que foi pago
            valor_base_pacote: 0,
            valor_total_foto_extra: 0,
            qtd_fotos_extra: 0,
            valor_foto_extra: 0,
            valor_adicional: 0,
            desconto: 0,
            produtos_incluidos: [], // Esvaziar array de produtos
            regras_congeladas: null, // Limpar regras
            
            // ✅ MANTER contexto descritivo
            descricao: `${workflowSession.pacote || workflowSession.descricao || ''} (Agendamento cancelado)`.trim(),
            observacoes: workflowSession.observacoes 
              ? `${workflowSession.observacoes}\n\n[${new Date().toLocaleDateString()}] Agendamento cancelado - preservado apenas valor pago de ${formatCurrency(valorPagoAtual)}` 
              : `[${new Date().toLocaleDateString()}] Agendamento cancelado - preservado apenas valor pago de ${formatCurrency(valorPagoAtual)}`,
            
            updated_at: new Date().toISOString(),
            updated_by: user.user.id
          })
          .eq('id', workflowSession.id)
          .eq('user_id', user.user.id)
          .select();

        if (updateError) {
          console.error('❌ Erro ao marcar sessão como histórico:', updateError);
          throw new Error(`Falha ao preservar histórico: ${updateError.message}`);
        }

        if (!updatedSession || updatedSession.length === 0) {
          console.warn('⚠️ Sessão não encontrada para atualização');
        }

        console.log(`✅ Session marked as historical - preserved only R$ ${valorPagoAtual.toFixed(2)} paid`);
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

  // Availability - FASE 1: Migração para Supabase
  async loadAvailabilitySlots(): Promise<AvailabilitySlot[]> {
    try {
      const user = await supabase.auth.getUser();
      if (!user.data.user) {
        console.warn('⚠️ Usuário não autenticado');
        return [];
      }

      const { data, error } = await supabase
        .from('availability_slots')
        .select('*')
        .eq('user_id', user.data.user.id)
        .order('date', { ascending: true })
        .order('start_time', { ascending: true });

      if (error) {
        console.error('❌ Erro ao carregar availability slots:', error);
        throw error;
      }

      // Converter formato Supabase para o formato da aplicação
      const slots: AvailabilitySlot[] = (data || []).map(slot => ({
        id: slot.id,
        date: slot.date,
        time: slot.start_time,
        duration: this.calculateDuration(slot.start_time, slot.end_time),
        typeId: slot.type || 'disponivel',
        label: slot.description || this.getLabelFromType(slot.type),
        color: this.getColorFromType(slot.type)
      }));

      console.log(`✅ ${slots.length} availability slots carregados do Supabase`);
      return slots;
    } catch (error) {
      console.error('❌ Erro ao carregar slots:', error);
      return [];
    }
  }

  async saveAvailabilitySlots(slots: AvailabilitySlot[]): Promise<void> {
    try {
      const user = await supabase.auth.getUser();
      if (!user.data.user) {
        throw new Error('Usuário não autenticado');
      }

      // Converter formato da aplicação para formato Supabase
      const supabaseSlots = slots.map(slot => ({
        id: slot.id,
        user_id: user.data.user.id,
        date: slot.date,
        start_time: slot.time,
        end_time: this.calculateEndTime(slot.time, slot.duration),
        type: slot.typeId || 'disponivel',
        description: slot.label || null
      }));

      // Upsert (insert ou update)
      const { error } = await supabase
        .from('availability_slots')
        .upsert(supabaseSlots, { onConflict: 'id' });

      if (error) {
        console.error('❌ Erro ao salvar availability slots:', error);
        throw error;
      }

      console.log(`✅ ${supabaseSlots.length} slots salvos no Supabase`);
    } catch (error) {
      console.error('❌ Erro ao salvar slots:', error);
      throw error;
    }
  }

  /**
   * Add new availability slots (FASE 1)
   */
  async addAvailabilitySlots(slots: Omit<AvailabilitySlot, 'id'>[]): Promise<void> {
    try {
      const user = await supabase.auth.getUser();
      if (!user.data.user) {
        throw new Error('Usuário não autenticado');
      }

      console.log(`🔄 Adicionando ${slots.length} novos slots de disponibilidade...`);

      // Converter formato da aplicação para formato Supabase
      const supabaseSlots = slots.map(slot => ({
        user_id: user.data.user.id,
        date: slot.date,
        start_time: slot.time,
        end_time: this.calculateEndTime(slot.time, slot.duration || 60),
        type: slot.typeId || 'disponivel',
        description: slot.label || null
      }));

      // Insert (não upsert, pois são novos registros)
      const { data, error } = await supabase
        .from('availability_slots')
        .insert(supabaseSlots)
        .select();

      if (error) {
        console.error('❌ Erro ao adicionar availability slots:', error);
        throw error;
      }

      console.log(`✅ ${data?.length || 0} slots adicionados com sucesso ao Supabase`);
    } catch (error) {
      console.error('❌ Erro ao adicionar slots:', error);
      throw error;
    }
  }

  async deleteAvailabilitySlot(id: string): Promise<void> {
    try {
      const user = await supabase.auth.getUser();
      if (!user.data.user) {
        throw new Error('Usuário não autenticado');
      }

      const { error } = await supabase
        .from('availability_slots')
        .delete()
        .eq('id', id)
        .eq('user_id', user.data.user.id);

      if (error) {
        console.error('❌ Erro ao deletar slot:', error);
        throw error;
      }

      console.log(`✅ Slot ${id} deletado do Supabase`);
    } catch (error) {
      console.error('❌ Erro ao deletar slot:', error);
      throw error;
    }
  }

  async clearAvailabilityForDate(date: string): Promise<void> {
    try {
      const user = await supabase.auth.getUser();
      if (!user.data.user) {
        throw new Error('Usuário não autenticado');
      }

      const { data, error } = await supabase
        .from('availability_slots')
        .delete()
        .eq('date', date)
        .eq('user_id', user.data.user.id)
        .select();

      if (error) {
        console.error('❌ Erro ao limpar slots da data:', error);
        throw error;
      }

      console.log(`✅ ${data?.length || 0} slots removidos da data ${date}`);
    } catch (error) {
      console.error('❌ Erro ao limpar data:', error);
      throw error;
    }
  }

  // Métodos auxiliares
  private calculateDuration(startTime: string, endTime: string): number {
    const [startHour, startMin] = startTime.split(':').map(Number);
    const [endHour, endMin] = endTime.split(':').map(Number);
    return (endHour * 60 + endMin) - (startHour * 60 + startMin);
  }

  private calculateEndTime(startTime: string, duration: number): string {
    const [hour, min] = startTime.split(':').map(Number);
    const totalMinutes = hour * 60 + min + duration;
    const endHour = Math.floor(totalMinutes / 60);
    const endMin = totalMinutes % 60;
    return `${String(endHour).padStart(2, '0')}:${String(endMin).padStart(2, '0')}`;
  }

  private getLabelFromType(type: string | null): string {
    const typeMap: Record<string, string> = {
      'disponivel': 'Disponível',
      'almoco': 'Almoço',
      'reuniao': 'Reunião'
    };
    return type ? typeMap[type] || type : 'Disponível';
  }

  private getColorFromType(type: string | null): string {
    const colorMap: Record<string, string> = {
      'disponivel': '#10b981',
      'almoco': '#f59e0b',
      'reuniao': '#3b82f6'
    };
    return type ? colorMap[type] || '#10b981' : '#10b981';
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

  /**
   * Add a new availability type (FASE 2)
   */
  async addAvailabilityType(typeData: Omit<AvailabilityType, 'id'>): Promise<AvailabilityType> {
    const newType: AvailabilityType = {
      id: crypto.randomUUID(),
      ...typeData
    };
    
    const types = await this.loadAvailabilityTypes();
    const updatedTypes = [...types, newType];
    
    try {
      localStorage.setItem('agenda_availability_types', JSON.stringify(updatedTypes));
      console.log('✅ Tipo de disponibilidade adicionado:', newType);
      return newType;
    } catch (error) {
      console.error('❌ Erro ao adicionar availability type:', error);
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
