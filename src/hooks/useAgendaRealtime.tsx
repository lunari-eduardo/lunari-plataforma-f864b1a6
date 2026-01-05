/**
 * Hook para gerenciar agenda em tempo real via Supabase
 * Substitui completamente o uso de localStorage para appointments
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { AppointmentStatus } from '@/hooks/useAgenda';
import type { Appointment } from '@/hooks/useAgenda';
import { AvailabilitySlot, AvailabilityType } from '@/types/availability';

interface AgendaRealtimeState {
  appointments: Appointment[];
  availability: AvailabilitySlot[];
  isLoading: boolean;
  error: string | null;
}

export const useAgendaRealtime = () => {
  const [state, setState] = useState<AgendaRealtimeState>({
    appointments: [],
    availability: [],
    isLoading: true,
    error: null
  });

  // ============= CARREGAR DADOS INICIAIS =============
  
  const loadAppointments = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));
      
      const { data, error } = await supabase
        .from('appointments')
        .select('*')
        .order('date', { ascending: true });

      if (error) throw error;

      // ✅ FASE 4: Usar parseDateFromStorage para evitar bugs de timezone
      const { parseDateFromStorage } = await import('@/utils/dateUtils');
      
      const appointmentsMapped: Appointment[] = (data || []).map(app => ({
        id: app.id,
        title: app.title,
        date: parseDateFromStorage(app.date), // ✅ CORRIGIDO: Evita bug de timezone
        time: app.time,
        status: app.status as AppointmentStatus,
        type: app.type,
        client: app.title,
        clienteId: app.cliente_id,
        packageId: app.package_id,
        orcamentoId: app.orcamento_id,
        sessionId: app.session_id,
        description: app.description || '',
        paidAmount: Number(app.paid_amount) || 0,
        origem: (app.origem || 'agenda') as 'agenda' | 'orcamento'
      }));

      setState(prev => ({ 
        ...prev, 
        appointments: appointmentsMapped, 
        isLoading: false 
      }));
      
      console.log('✅ Appointments carregados do Supabase:', appointmentsMapped.length);
    } catch (error) {
      console.error('❌ Erro ao carregar appointments:', error);
      setState(prev => ({ 
        ...prev, 
        isLoading: false, 
        error: error instanceof Error ? error.message : 'Erro desconhecido' 
      }));
    }
  }, []);

  const loadAvailability = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('availability_slots')
        .select('*')
        .order('date', { ascending: true });

      if (error) throw error;

      const availabilityMapped: AvailabilitySlot[] = (data || []).map(slot => ({
        id: slot.id,
        date: slot.date,
        time: slot.start_time,
        duration: 60,
        typeId: slot.type || 'disponivel'
      }));

      setState(prev => ({ 
        ...prev, 
        availability: availabilityMapped
      }));
      
      console.log('✅ Availability carregada do Supabase:', availabilityMapped.length);
    } catch (error) {
      console.error('❌ Erro ao carregar availability:', error);
    }
  }, []);

  // ============= REAL-TIME SUBSCRIPTIONS =============
  
  useEffect(() => {
    loadAppointments();
    loadAvailability();

    // ✅ FASE 3: Remover subscription de appointments - deixar apenas availability
    // O useAppointmentWorkflowSync é o canal PRINCIPAL para appointments
    const availabilityChannel = supabase
      .channel('availability_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'availability_slots' }, loadAvailability)
      .subscribe();

    return () => {
      supabase.removeChannel(availabilityChannel);
    };
  }, [loadAppointments, loadAvailability]);

  // ============= OPERAÇÕES CRUD =============
  
  const adicionarAppointment = useCallback(async (appointmentData: Omit<Appointment, 'id'>) => {
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error('Usuário não autenticado');

      const { data, error } = await supabase
        .from('appointments')
        .insert({
          title: appointmentData.title,
          date: appointmentData.date.toISOString().split('T')[0],
          time: appointmentData.time,
          status: appointmentData.status,
          type: appointmentData.type,
          cliente_id: appointmentData.clienteId,
          package_id: appointmentData.packageId,
          orcamento_id: appointmentData.orcamentoId,
          session_id: appointmentData.sessionId,
          description: appointmentData.description,
          paid_amount: appointmentData.paidAmount || 0,
          origem: appointmentData.origem || 'agenda',
          user_id: user.user.id
        })
        .select()
        .single();

      if (error) throw error;

      toast.success('Agendamento criado com sucesso');
      return { ...appointmentData, id: data.id } as Appointment;
    } catch (error) {
      console.error('❌ Erro ao adicionar appointment:', error);
      toast.error('Erro ao criar agendamento');
      throw error;
    }
  }, []);

  const atualizarAppointment = useCallback(async (id: string, updates: Partial<Appointment>) => {
    try {
      const updateData: any = {};
      
      if (updates.title) updateData.title = updates.title;
      if (updates.date) updateData.date = updates.date.toISOString().split('T')[0];
      if (updates.time) updateData.time = updates.time;
      if (updates.status) updateData.status = updates.status;
      if (updates.type) updateData.type = updates.type;
      if (updates.clienteId !== undefined) updateData.cliente_id = updates.clienteId;
      if (updates.packageId !== undefined) updateData.package_id = updates.packageId;
      if (updates.description !== undefined) updateData.description = updates.description;
      if (updates.paidAmount !== undefined) updateData.paid_amount = updates.paidAmount;

      const { error } = await supabase
        .from('appointments')
        .update(updateData)
        .eq('id', id);

      if (error) throw error;
      
      toast.success('Agendamento atualizado com sucesso');
    } catch (error) {
      console.error('❌ Erro ao atualizar appointment:', error);
      toast.error('Erro ao atualizar agendamento');
      throw error;
    }
  }, []);

  const removerAppointment = useCallback(async (id: string) => {
    try {
      const { error } = await supabase
        .from('appointments')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      toast.success('Agendamento removido com sucesso');
    } catch (error) {
      console.error('❌ Erro ao remover appointment:', error);
      toast.error('Erro ao remover agendamento');
      throw error;
    }
  }, []);

  return {
    appointments: state.appointments,
    availability: state.availability,
    isLoading: state.isLoading,
    error: state.error,
    adicionarAppointment,
    atualizarAppointment,
    removerAppointment,
    reloadAppointments: loadAppointments,
    reloadAvailability: loadAvailability
  };
};