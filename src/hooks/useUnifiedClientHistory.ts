/**
 * Hook for unified client history showing appointments, sessions, and transactions
 */

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface UnifiedHistoryItem {
  id: string;
  type: 'appointment' | 'session' | 'transaction';
  data: string;
  hora?: string;
  titulo: string;
  descricao?: string;
  status: string;
  valor?: number;
  sessionId?: string;
  packageId?: string;
  pacoteNome?: string;
  categoria?: string;
}

export function useUnifiedClientHistory(clienteId: string) {
  const [history, setHistory] = useState<UnifiedHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadHistory = useCallback(async () => {
    if (!clienteId) {
      setHistory([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Load appointments, sessions, and transactions in parallel
      const [appointmentsData, sessionsData, transactionsData] = await Promise.all([
        supabase
          .from('appointments')
          .select(`
            *,
            pacotes (nome, categorias(nome))
          `)
          .eq('cliente_id', clienteId)
          .eq('user_id', user.id),
        
        supabase
          .from('clientes_sessoes')
          .select(`
            *,
            appointments (package_id),
            pacotes (nome, categorias(nome))
          `)
          .eq('cliente_id', clienteId)
          .eq('user_id', user.id),
        
        supabase
          .from('clientes_transacoes')
          .select('*')
          .eq('cliente_id', clienteId)
          .eq('user_id', user.id)
      ]);

      if (appointmentsData.error) throw appointmentsData.error;
      if (sessionsData.error) throw sessionsData.error;
      if (transactionsData.error) throw transactionsData.error;

      const historyItems: UnifiedHistoryItem[] = [];

      // Add appointments
      if (appointmentsData.data) {
        appointmentsData.data.forEach(appointment => {
          const pacote = (appointment as any).pacotes;
          historyItems.push({
            id: appointment.id,
            type: 'appointment',
            data: appointment.date,
            hora: appointment.time,
            titulo: appointment.title,
            descricao: appointment.description || '',
            status: appointment.status,
            sessionId: appointment.session_id,
            packageId: appointment.package_id,
            pacoteNome: pacote?.nome,
            categoria: pacote?.categorias?.nome
          });
        });
      }

      // Add sessions
      if (sessionsData.data) {
        sessionsData.data.forEach(session => {
          const appointment = (session as any).appointments;
          const pacote = (session as any).pacotes;
          
          historyItems.push({
            id: session.id,
            type: 'session',
            data: session.data_sessao,
            hora: session.hora_sessao,
            titulo: `Sessão - ${session.categoria}`,
            descricao: session.descricao || '',
            status: session.status,
            valor: session.valor_total,
            sessionId: session.session_id,
            packageId: appointment?.package_id,
            pacoteNome: pacote?.nome || session.pacote,
            categoria: session.categoria
          });
        });
      }

      // Add transactions
      if (transactionsData.data) {
        transactionsData.data.forEach(transaction => {
          historyItems.push({
            id: transaction.id,
            type: 'transaction',
            data: transaction.data_transacao,
            titulo: `${transaction.tipo} - ${transaction.descricao || 'Pagamento'}`,
            descricao: transaction.descricao || '',
            status: 'concluido',
            valor: transaction.valor,
            sessionId: transaction.session_id
          });
        });
      }

      // Sort by date (newest first)
      historyItems.sort((a, b) => {
        const dateA = new Date(a.data);
        const dateB = new Date(b.data);
        return dateB.getTime() - dateA.getTime();
      });

      setHistory(historyItems);
      setError(null);

    } catch (error) {
      console.error('❌ Error loading unified client history:', error);
      setError(error instanceof Error ? error.message : 'Erro desconhecido');
      toast.error('Erro ao carregar histórico do cliente');
    } finally {
      setLoading(false);
    }
  }, [clienteId]);

  // Set up real-time subscriptions
  useEffect(() => {
    if (!clienteId) return;

    const setupRealtime = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Subscribe to appointments changes
      const appointmentsChannel = supabase
        .channel('client_appointments_changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'appointments',
            filter: `cliente_id=eq.${clienteId}`,
          },
          () => {
            console.log('🔄 Client appointment changed, reloading history');
            loadHistory();
          }
        )
        .subscribe();

      // Subscribe to sessions changes
      const sessionsChannel = supabase
        .channel('client_sessions_changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'clientes_sessoes',
            filter: `cliente_id=eq.${clienteId}`,
          },
          () => {
            console.log('🔄 Client session changed, reloading history');
            loadHistory();
          }
        )
        .subscribe();

      // Subscribe to transactions changes
      const transactionsChannel = supabase
        .channel('client_transactions_changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'clientes_transacoes',
            filter: `cliente_id=eq.${clienteId}`,
          },
          () => {
            console.log('🔄 Client transaction changed, reloading history');
            loadHistory();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(appointmentsChannel);
        supabase.removeChannel(sessionsChannel);
        supabase.removeChannel(transactionsChannel);
      };
    };

    setupRealtime();
  }, [clienteId, loadHistory]);

  // Load initial data
  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  return {
    history,
    loading,
    error,
    refetch: loadHistory
  };
}