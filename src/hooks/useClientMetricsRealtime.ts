import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface ClientMetrics {
  totalSessoes: number;
  totalFaturado: number;
  aReceber: number;
  agendamentos: number;
  agendado: number;
  ultimaSessao?: string;
  sessaoEmAndamento: boolean;
}

export function useClientMetricsRealtime(clienteId: string) {
  const [metrics, setMetrics] = useState<ClientMetrics>({
    totalSessoes: 0,
    totalFaturado: 0,
    aReceber: 0,
    agendamentos: 0,
    agendado: 0,
    sessaoEmAndamento: false,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const calculateMetrics = useCallback(async () => {
    if (!clienteId) return;

    try {
      setLoading(true);
      setError(null);

      // Get appointments count
      const { count: appointmentsCount } = await supabase
        .from('appointments')
        .select('*', { count: 'exact', head: true })
        .eq('cliente_id', clienteId);

      // Get sessions data with aggregations
      const { data: sessionsData, error: sessionsError } = await supabase
        .from('clientes_sessoes')
        .select('valor_total, valor_pago, data_sessao, status')
        .eq('cliente_id', clienteId);

      if (sessionsError) throw sessionsError;

      // Calculate metrics
      const totalSessoes = sessionsData?.length || 0;
      const totalFaturado = sessionsData?.reduce((sum, session) => sum + (session.valor_pago || 0), 0) || 0;
      const totalValor = sessionsData?.reduce((sum, session) => sum + (session.valor_total || 0), 0) || 0;
      const aReceber = totalValor - totalFaturado;
      
      // Find latest session
      const sortedSessions = sessionsData?.sort((a, b) => 
        new Date(b.data_sessao).getTime() - new Date(a.data_sessao).getTime()
      );
      const ultimaSessao = sortedSessions?.[0]?.data_sessao;
      
      // Check if there's a session in progress
      const sessaoEmAndamento = sessionsData?.some(session => 
        session.status === 'em_andamento' || session.status === 'agendado'
      ) || false;

      setMetrics({
        totalSessoes,
        totalFaturado,
        aReceber,
        agendamentos: appointmentsCount || 0,
        agendado: aReceber, // Por enquanto, agendado é igual a aReceber
        ultimaSessao,
        sessaoEmAndamento,
      });

    } catch (err) {
      console.error('❌ Erro ao calcular métricas:', err);
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  }, [clienteId]);

  // Real-time subscriptions for all related tables
  useEffect(() => {
    if (!clienteId) return;

    calculateMetrics();

    // Subscribe to appointments changes
    const appointmentsChannel = supabase
      .channel('client-appointments-metrics')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'appointments',
          filter: `cliente_id=eq.${clienteId}`,
        },
        () => {
          console.log('🔄 Recalculating metrics due to appointments change');
          calculateMetrics();
        }
      )
      .subscribe();

    // Subscribe to sessions changes
    const sessionsChannel = supabase
      .channel('client-sessions-metrics')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'clientes_sessoes',
          filter: `cliente_id=eq.${clienteId}`,
        },
        () => {
          console.log('🔄 Recalculating metrics due to sessions change');
          calculateMetrics();
        }
      )
      .subscribe();

    // Subscribe to transactions changes
    const transactionsChannel = supabase
      .channel('client-transactions-metrics')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'clientes_transacoes',
          filter: `cliente_id=eq.${clienteId}`,
        },
        () => {
          console.log('🔄 Recalculating metrics due to transactions change');
          calculateMetrics();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(appointmentsChannel);
      supabase.removeChannel(sessionsChannel);
      supabase.removeChannel(transactionsChannel);
    };
  }, [clienteId, calculateMetrics]);

  return {
    metrics,
    loading,
    error,
    refetch: calculateMetrics,
  };
}