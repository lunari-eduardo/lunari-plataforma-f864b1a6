import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ClientesSessaoSupabase, generateUniversalSessionId } from '@/types/appointments-supabase';
import { toast } from 'sonner';

export function useSessionsRealtime(clienteId?: string) {
  const [sessions, setSessions] = useState<ClientesSessaoSupabase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load sessions from Supabase
  const loadSessions = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      let query = supabase
        .from('clientes_sessoes')
        .select('*')
        .order('data_sessao', { ascending: false });

      if (clienteId) {
        query = query.eq('cliente_id', clienteId);
      }

      const { data, error: fetchError } = await query;

      if (fetchError) {
        throw fetchError;
      }

      setSessions((data as ClientesSessaoSupabase[]) || []);
    } catch (err) {
      console.error('❌ Erro ao carregar sessões:', err);
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
      toast.error('Erro ao carregar sessões');
    } finally {
      setLoading(false);
    }
  }, [clienteId]);

  // Create session
  const createSession = useCallback(async (sessionData: Omit<ClientesSessaoSupabase, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      const newSession = {
        ...sessionData,
        user_id: user.id,
      };

      const { data, error } = await supabase
        .from('clientes_sessoes')
        .insert([newSession])
        .select()
        .single();

      if (error) throw error;

      toast.success('Sessão criada com sucesso');
      return data;
    } catch (err) {
      console.error('❌ Erro ao criar sessão:', err);
      toast.error('Erro ao criar sessão');
      throw err;
    }
  }, []);

  // Update session
  const updateSession = useCallback(async (id: string, updates: Partial<ClientesSessaoSupabase>) => {
    try {
      const { data, error } = await supabase
        .from('clientes_sessoes')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      toast.success('Sessão atualizada com sucesso');
      return data;
    } catch (err) {
      console.error('❌ Erro ao atualizar sessão:', err);
      toast.error('Erro ao atualizar sessão');
      throw err;
    }
  }, []);

  // Delete session
  const deleteSession = useCallback(async (id: string) => {
    try {
      const { error } = await supabase
        .from('clientes_sessoes')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast.success('Sessão excluída com sucesso');
    } catch (err) {
      console.error('❌ Erro ao excluir sessão:', err);
      toast.error('Erro ao excluir sessão');
      throw err;
    }
  }, []);

  // Convert appointment to session
  const convertAppointmentToSession = useCallback(async (appointmentId: string, sessionData: Partial<ClientesSessaoSupabase>) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      // Get appointment details
      const { data: appointment, error: appointmentError } = await supabase
        .from('appointments')
        .select('*')
        .eq('id', appointmentId)
        .single();

      if (appointmentError) throw appointmentError;

      const newSession = {
        cliente_id: appointment.cliente_id!,
        session_id: appointment.session_id,
        appointment_id: appointmentId,
        data_sessao: appointment.date,
        hora_sessao: appointment.time,
        categoria: appointment.type,
        status: 'em_andamento',
        valor_total: appointment.paid_amount || 0,
        valor_pago: appointment.paid_amount || 0,
        produtos_incluidos: [],
        ...sessionData,
        user_id: user.id,
      };

      const { data, error } = await supabase
        .from('clientes_sessoes')
        .insert([newSession])
        .select()
        .single();

      if (error) throw error;

      // Update appointment status
      await supabase
        .from('appointments')
        .update({ status: 'confirmado' })
        .eq('id', appointmentId);

      toast.success('Agendamento convertido em sessão');
      return data;
    } catch (err) {
      console.error('❌ Erro ao converter agendamento:', err);
      toast.error('Erro ao converter agendamento');
      throw err;
    }
  }, []);

  // Real-time subscription
  useEffect(() => {
    loadSessions();

    const channel = supabase
      .channel('sessions-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'clientes_sessoes',
          filter: clienteId ? `cliente_id=eq.${clienteId}` : undefined,
        },
        (payload) => {
          console.log('🔄 Session real-time update:', payload);
          
          if (payload.eventType === 'INSERT') {
            setSessions(prev => [payload.new as ClientesSessaoSupabase, ...prev]);
          } else if (payload.eventType === 'UPDATE') {
            setSessions(prev => 
              prev.map(session => 
                session.id === payload.new.id 
                  ? payload.new as ClientesSessaoSupabase 
                  : session
              )
            );
          } else if (payload.eventType === 'DELETE') {
            setSessions(prev => 
              prev.filter(session => session.id !== payload.old.id)
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadSessions, clienteId]);

  return {
    sessions,
    loading,
    error,
    createSession,
    updateSession,
    deleteSession,
    convertAppointmentToSession,
    refetch: loadSessions,
  };
}