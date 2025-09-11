import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { generateUniversalSessionId } from '@/types/appointments-supabase';
import { SessionData } from '@/types/workflow';
import { toast } from '@/hooks/use-toast';

export interface WorkflowSession {
  id: string;
  user_id: string;
  cliente_id: string;
  session_id: string;
  appointment_id?: string;
  orcamento_id?: string;
  data_sessao: string;
  hora_sessao: string;
  categoria: string;
  pacote?: string;
  descricao?: string;
  status: string;
  valor_total: number;
  valor_pago: number;
  produtos_incluidos: any;
  created_at?: string;
  updated_at?: string;
  updated_by?: string;
}

export const useWorkflowRealtime = () => {
  const [sessions, setSessions] = useState<WorkflowSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load sessions from Supabase
  const loadSessions = useCallback(async () => {
    try {
      setLoading(true);
      const { data: user } = await supabase.auth.getUser();
      
      if (!user?.user) {
        setError('User not authenticated');
        return;
      }

      const { data, error: fetchError } = await supabase
        .from('clientes_sessoes')
        .select(`
          *,
          clientes (
            nome,
            email,
            telefone
          )
        `)
        .eq('user_id', user.user.id)
        .order('data_sessao', { ascending: false })
        .order('hora_sessao', { ascending: true });

      if (fetchError) {
        throw fetchError;
      }

      setSessions(data || []);
      setError(null);
    } catch (err) {
      console.error('Error loading workflow sessions:', err);
      setError(err instanceof Error ? err.message : 'Failed to load sessions');
      toast({
        title: "Erro ao carregar sessões",
        description: "Não foi possível carregar as sessões do workflow.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  // Create new session
  const createSession = useCallback(async (sessionData: Omit<WorkflowSession, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => {
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user?.user) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('clientes_sessoes')
        .insert({
          ...sessionData,
          user_id: user.user.id,
          updated_by: user.user.id,
        })
        .select()
        .single();

      if (error) throw error;

      setSessions(prev => [data, ...prev]);
      toast({
        title: "Sessão criada",
        description: "Sessão criada com sucesso.",
      });

      return data;
    } catch (err) {
      console.error('Error creating session:', err);
      toast({
        title: "Erro ao criar sessão", 
        description: err instanceof Error ? err.message : 'Failed to create session',
        variant: "destructive",
      });
      throw err;
    }
  }, []);

  // Update session
  const updateSession = useCallback(async (id: string, updates: Partial<WorkflowSession>) => {
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user?.user) throw new Error('User not authenticated');

      const { error } = await supabase
        .from('clientes_sessoes')
        .update({
          ...updates,
          updated_by: user.user.id
        })
        .eq('id', id)
        .eq('user_id', user.user.id);

      if (error) throw error;

      setSessions(prev => prev.map(session => 
        session.id === id ? { ...session, ...updates } : session
      ));

      toast({
        title: "Sessão atualizada",
        description: "Sessão atualizada com sucesso.",
      });
    } catch (err) {
      console.error('Error updating session:', err);
      toast({
        title: "Erro ao atualizar sessão",
        description: err instanceof Error ? err.message : 'Failed to update session',
        variant: "destructive",
      });
      throw err;
    }
  }, []);

  // Delete session with flexible options
  const deleteSession = useCallback(async (id: string, includePayments: boolean = false) => {
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user?.user) throw new Error('User not authenticated');

      // Find session data for session_id
      const session = sessions.find(s => s.id === id);
      if (!session) throw new Error('Session not found');

      // Use flexible deletion utility
      const { deleteSessionWithOptions } = await import('@/utils/sessionDeletionUtils');
      
      await deleteSessionWithOptions(session.session_id, {
        includePayments,
        userId: user.user.id
      });

      setSessions(prev => prev.filter(session => session.id !== id));
      
      toast({
        title: "Sessão excluída",
        description: includePayments ? 
          "Sessão e pagamentos excluídos com sucesso." :
          "Sessão excluída. Pagamentos mantidos para auditoria.",
      });
    } catch (err) {
      console.error('Error deleting session:', err);
      toast({
        title: "Erro ao excluir sessão",
        description: err instanceof Error ? err.message : 'Failed to delete session',
        variant: "destructive",
      });
      throw err;
    }
  }, [sessions]);

  // Convert confirmed appointment to session
  const createSessionFromAppointment = useCallback(async (appointmentId: string, appointmentData: any) => {
    try {
      const sessionId = generateUniversalSessionId('workflow');
      
      const sessionData = {
        session_id: sessionId,
        appointment_id: appointmentId,
        cliente_id: appointmentData.clienteId || '',
        data_sessao: appointmentData.date,
        hora_sessao: appointmentData.time,
        categoria: appointmentData.categoria || '',
        pacote: appointmentData.pacote || '',
        descricao: appointmentData.description || '',
        status: 'agendado',
        valor_total: appointmentData.valorPacote || 0,
        valor_pago: appointmentData.paidAmount || 0,
        produtos_incluidos: appointmentData.produtosIncluidos || []
      };

      return await createSession(sessionData);
    } catch (err) {
      console.error('Error creating session from appointment:', err);
      throw err;
    }
  }, [createSession]);

  // Real-time subscription
  useEffect(() => {
    loadSessions();

    const channel = supabase
      .channel('workflow-sessions')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'clientes_sessoes'
        },
        async (payload) => {
          console.log('Real-time workflow session change:', payload);
          
          if (payload.eventType === 'INSERT') {
            setSessions(prev => [payload.new as WorkflowSession, ...prev]);
          } else if (payload.eventType === 'UPDATE') {
            setSessions(prev => prev.map(session => 
              session.id === payload.new.id ? payload.new as WorkflowSession : session
            ));
          } else if (payload.eventType === 'DELETE') {
            setSessions(prev => prev.filter(session => session.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadSessions]);

  // Convert to SessionData format for compatibility
  const convertToSessionData = useCallback((session: WorkflowSession): SessionData => {
    return {
      id: session.id,
      data: session.data_sessao,
      hora: session.hora_sessao,
      nome: (session as any).clientes?.nome || '',
      email: (session as any).clientes?.email || '',
      descricao: session.descricao || '',
      status: session.status,
      whatsapp: (session as any).clientes?.telefone || '',
      categoria: session.categoria,
      pacote: session.pacote || '',
      valorPacote: `R$ ${session.valor_total.toFixed(2).replace('.', ',')}`,
      valorFotoExtra: 'R$ 35,00',
      qtdFotosExtra: 0,
      valorTotalFotoExtra: 'R$ 0,00',
      produto: '',
      qtdProduto: 0,
      valorTotalProduto: 'R$ 0,00',
      valorAdicional: 'R$ 0,00',
      detalhes: session.descricao || '',
      observacoes: '',
      valor: `R$ ${session.valor_total.toFixed(2).replace('.', ',')}`,
      total: `R$ ${session.valor_total.toFixed(2).replace('.', ',')}`,
      valorPago: `R$ ${session.valor_pago.toFixed(2).replace('.', ',')}`,
      restante: `R$ ${(session.valor_total - session.valor_pago).toFixed(2).replace('.', ',')}`,
      desconto: 0,
      pagamentos: [],
      produtosList: session.produtos_incluidos || [],
      clienteId: session.cliente_id
    };
  }, []);

  // Get sessions formatted as SessionData
  const getSessionsData = useCallback(() => {
    return sessions.map(convertToSessionData);
  }, [sessions, convertToSessionData]);

  return {
    sessions,
    sessionsData: getSessionsData(),
    loading,
    error,
    createSession,
    updateSession,
    deleteSession,
    createSessionFromAppointment,
    refetch: loadSessions
  };
};