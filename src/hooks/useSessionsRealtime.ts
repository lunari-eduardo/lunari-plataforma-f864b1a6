import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ClientesSessaoSupabase, generateUniversalSessionId } from '@/types/appointments-supabase';
import { toast } from 'sonner';
import { formatDateForStorage } from '@/utils/dateUtils';

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

  // Delete session — SEMPRE via RPC atômica para garantir remoção do
  // agendamento vinculado e integridade financeira. Nunca fazer DELETE direto.
  const deleteSession = useCallback(async (id: string) => {
    try {
      const { data, error } = await supabase.rpc('delete_workflow_session_cascade', {
        p_session_pk: id,
        p_action: 'remove',
      });

      if (error) throw error;
      if (data && typeof data === 'object' && (data as any).success === false) {
        throw new Error((data as any).error || 'Falha ao excluir sessão');
      }

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

  // Create manual session (for historical data)
  const createManualSession = useCallback(async (data: {
    clienteId: string;
    dataSessao: string;
    horaSessao: string;
    categoria: string;
    pacote?: string;
    descricao?: string;
    status?: string;
    valorBasePacote: number;
    qtdFotosExtra?: number;
    valorFotoExtra?: number;
    valorAdicional?: number;
    desconto?: number;
    valorPago?: number;
    produtosIncluidos?: Array<{
      nome: string;
      quantidade: number;
      valorUnitario: number;
    }>;
    detalhes?: string;
    observacoes?: string;
  }) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      // Generate unique session_id for historical data
      const sessionId = `HIST-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      // Calculate total foto extra
      const valorTotalFotoExtra = (data.qtdFotosExtra || 0) * (data.valorFotoExtra || 0);

      // Calculate total from manual products
      const produtosComTipo = (data.produtosIncluidos || []).map(p => ({
        ...p,
        tipo: 'manual' as const,
        produzido: false,
        entregue: false
      }));

      // Calcular valor unitário calculado (total ÷ qtd) e total de fotos extras
      const qtdFotosExtra = data.qtdFotosExtra || 0;
      const valorFotoExtraUnitario = data.valorFotoExtra || 0;
      const totalFotosExtras = qtdFotosExtra * valorFotoExtraUnitario;

      // Calculate valor_total usando o totalFotosExtras calculado
      const valorTotal = 
        data.valorBasePacote +
        totalFotosExtras +
        produtosComTipo.reduce((sum, p) => sum + (p.quantidade * p.valorUnitario), 0) +
        (data.valorAdicional || 0) -
        (data.desconto || 0);

      // CORREÇÃO: Criar regras congeladas para sessões manuais
      // Flag isManualHistorical impede recálculo na tabela
      const regrasCongeladas = {
        modelo: 'fixo' as const,
        valorFixo: valorFotoExtraUnitario, // Valor unitário calculado (total/qtd)
        isManualHistorical: true, // FLAG: Impede recálculo na tabela
        pacote: {
          nome: data.pacote || null,
          valorBase: data.valorBasePacote,
          valorFotoExtra: valorFotoExtraUnitario
        },
        createdAt: new Date().toISOString(),
        source: 'manual_historical' as const
      };

      const newSession = {
        cliente_id: data.clienteId,
        user_id: user.id,
        session_id: sessionId,
        data_sessao: data.dataSessao,
        hora_sessao: data.horaSessao,
        categoria: data.categoria,
        pacote: data.pacote || null,
        descricao: data.descricao || null,
        status: data.status || 'concluído',
        valor_base_pacote: data.valorBasePacote,
        qtd_fotos_extra: qtdFotosExtra,
        valor_foto_extra: valorFotoExtraUnitario,
        valor_total_foto_extra: totalFotosExtras, // Valor exato calculado
        produtos_incluidos: produtosComTipo,
        valor_adicional: data.valorAdicional || 0,
        desconto: data.desconto || 0,
        valor_total: valorTotal,
        valor_pago: data.valorPago || 0,
        detalhes: data.detalhes || null,
        observacoes: data.observacoes || null,
        regras_congeladas: regrasCongeladas,
        appointment_id: null,
        orcamento_id: null,
      };

      const { data: insertedSession, error } = await supabase
        .from('clientes_sessoes')
        .insert([newSession])
        .select()
        .single();

      if (error) throw error;

      // Criar transação se valorPago > 0
      if ((data.valorPago || 0) > 0 && data.clienteId) {
        const { error: transactionError } = await supabase
          .from('clientes_transacoes')
          .insert({
            user_id: user.id,
            cliente_id: data.clienteId,
            session_id: sessionId,
            tipo: 'pagamento',
            valor: data.valorPago,
            descricao: 'Pagamento via adição rápida',
            data_transacao: formatDateForStorage(new Date()),
            updated_by: user.id
          });
        
        if (transactionError) {
          console.error('⚠️ Erro ao criar transação:', transactionError);
        } else {
          console.log('✅ Transação criada para sessão:', sessionId);
        }
      }

      toast.success('Sessão histórica criada com sucesso');
      return insertedSession;
    } catch (err) {
      console.error('❌ Erro ao criar sessão manual:', err);
      toast.error('Erro ao criar sessão manual');
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
    createManualSession,
    updateSession,
    deleteSession,
    convertAppointmentToSession,
    refetch: loadSessions,
  };
}