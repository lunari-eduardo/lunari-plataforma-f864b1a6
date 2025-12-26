import { useState, useEffect } from 'react';
import { Cliente } from '@/types/cliente';
import { supabase } from '@/integrations/supabase/client';

export interface ClientMetrics {
  id: string;
  nome: string;
  email: string;
  telefone: string;
  origem?: string;
  sessoes: number;
  totalFaturado: number;
  totalPago: number;
  aReceber: number;
  ultimaSessao: Date | null;
}

export function useClientMetrics(clientes: Cliente[]): ClientMetrics[] {
  const [metrics, setMetrics] = useState<ClientMetrics[]>([]);

  useEffect(() => {
    const fetchMetrics = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setMetrics([]);
        return;
      }

      // Fetch all sessions from Supabase
      const { data: sessionsData } = await supabase
        .from('clientes_sessoes')
        .select('cliente_id, valor_total, valor_pago, data_sessao')
        .eq('user_id', user.id);

      // Fetch all scheduled transactions from Supabase
      const { data: transacoesData } = await supabase
        .from('clientes_transacoes')
        .select('cliente_id, valor, tipo')
        .eq('user_id', user.id)
        .in('tipo', ['ajuste']);

      // Calculate metrics per client
      const metricsMap = new Map<string, ClientMetrics>();
      
      clientes.forEach(cliente => {
        // Client sessions
        const clienteSessions = sessionsData?.filter(s => s.cliente_id === cliente.id) || [];
        
        // Client scheduled transactions
        const clienteTransacoes = transacoesData?.filter(t => t.cliente_id === cliente.id) || [];
        
        // Calculations
        const totalSessoes = clienteSessions.length;
        const totalFaturado = clienteSessions.reduce((acc, s) => acc + (Number(s.valor_total) || 0), 0);
        const totalPago = clienteSessions.reduce((acc, s) => acc + (Number(s.valor_pago) || 0), 0);
        const totalAgendado = clienteTransacoes.reduce((acc, t) => acc + (Number(t.valor) || 0), 0);
        const aReceber = Math.max(0, totalFaturado - totalPago);
        
        // Last session
        const sortedSessions = clienteSessions
          .map(s => new Date(s.data_sessao))
          .filter(d => !isNaN(d.getTime()))
          .sort((a, b) => b.getTime() - a.getTime());
        const ultimaSessao = sortedSessions[0] || null;

        metricsMap.set(cliente.id, {
          id: cliente.id,
          nome: cliente.nome || '',
          email: cliente.email || '',
          telefone: cliente.telefone || '',
          origem: cliente.origem,
          sessoes: totalSessoes,
          totalFaturado,
          totalPago,
          aReceber,
          ultimaSessao
        });
      });

      setMetrics(Array.from(metricsMap.values()));
    };

    fetchMetrics();

    // Subscribe to sessions changes
    const sessionsChannel = supabase
      .channel('all_sessions_metrics')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'clientes_sessoes'
      }, () => {
        console.log('🔄 Sessões alteradas, recalculando métricas...');
        fetchMetrics();
      })
      .subscribe();

    // Subscribe to transactions changes
    const transactionsChannel = supabase
      .channel('all_transactions_metrics')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'clientes_transacoes'
      }, () => {
        console.log('🔄 Transações alteradas, recalculando métricas...');
        fetchMetrics();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(sessionsChannel);
      supabase.removeChannel(transactionsChannel);
    };
  }, [clientes]);

  return metrics;
}