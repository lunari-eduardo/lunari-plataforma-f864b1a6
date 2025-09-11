import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AppointmentSupabase, generateUniversalSessionId } from '@/types/appointments-supabase';
import { toast } from 'sonner';

export function useAppointmentsRealtime(clienteId?: string) {
  const [appointments, setAppointments] = useState<AppointmentSupabase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load appointments from Supabase
  const loadAppointments = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      let query = supabase
        .from('appointments')
        .select('*')
        .order('date', { ascending: false });

      if (clienteId) {
        query = query.eq('cliente_id', clienteId);
      }

      const { data, error: fetchError } = await query;

      if (fetchError) {
        throw fetchError;
      }

      setAppointments((data as AppointmentSupabase[]) || []);
    } catch (err) {
      console.error('❌ Erro ao carregar agendamentos:', err);
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
      toast.error('Erro ao carregar agendamentos');
    } finally {
      setLoading(false);
    }
  }, [clienteId]);

  // Create appointment
  const createAppointment = useCallback(async (appointmentData: Omit<AppointmentSupabase, 'id' | 'user_id' | 'session_id' | 'created_at' | 'updated_at'>) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      const newAppointment = {
        ...appointmentData,
        user_id: user.id,
        session_id: generateUniversalSessionId('appointment'),
      };

      const { data, error } = await supabase
        .from('appointments')
        .insert([newAppointment])
        .select()
        .single();

      if (error) throw error;

      toast.success('Agendamento criado com sucesso');
      return data;
    } catch (err) {
      console.error('❌ Erro ao criar agendamento:', err);
      toast.error('Erro ao criar agendamento');
      throw err;
    }
  }, []);

  // Update appointment
  const updateAppointment = useCallback(async (id: string, updates: Partial<AppointmentSupabase>) => {
    try {
      const { data, error } = await supabase
        .from('appointments')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      toast.success('Agendamento atualizado com sucesso');
      return data;
    } catch (err) {
      console.error('❌ Erro ao atualizar agendamento:', err);
      toast.error('Erro ao atualizar agendamento');
      throw err;
    }
  }, []);

  // Delete appointment
  const deleteAppointment = useCallback(async (id: string) => {
    try {
      const { error } = await supabase
        .from('appointments')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast.success('Agendamento excluído com sucesso');
    } catch (err) {
      console.error('❌ Erro ao excluir agendamento:', err);
      toast.error('Erro ao excluir agendamento');
      throw err;
    }
  }, []);

  // Real-time subscription
  useEffect(() => {
    loadAppointments();

    const channel = supabase
      .channel('appointments-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'appointments',
          filter: clienteId ? `cliente_id=eq.${clienteId}` : undefined,
        },
        (payload) => {
          console.log('🔄 Appointment real-time update:', payload);
          
          if (payload.eventType === 'INSERT') {
            setAppointments(prev => [payload.new as AppointmentSupabase, ...prev]);
          } else if (payload.eventType === 'UPDATE') {
            setAppointments(prev => 
              prev.map(appointment => 
                appointment.id === payload.new.id 
                  ? payload.new as AppointmentSupabase 
                  : appointment
              )
            );
          } else if (payload.eventType === 'DELETE') {
            setAppointments(prev => 
              prev.filter(appointment => appointment.id !== payload.old.id)
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadAppointments, clienteId]);

  return {
    appointments,
    loading,
    error,
    createAppointment,
    updateAppointment,
    deleteAppointment,
    refetch: loadAppointments,
  };
}