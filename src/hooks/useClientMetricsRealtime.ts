import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface ClientMetrics {
  totalSessoes: number;
  totalFaturado: number;
  totalPago: number;
  aReceber: number;
  agendamentos: number;
  agendado: number;
  totalGalerias: number;
  totalFotosExtras: number;
  faturamentoExtras: number;
  ultimaSessao?: string;
  sessaoEmAndamento: boolean;
}

export function useClientMetricsRealtime(clienteId: string) {
  const [metrics, setMetrics] = useState<ClientMetrics>({
    totalSessoes: 0,
    totalFaturado: 0,
    totalPago: 0,
    aReceber: 0,
    agendamentos: 0,
    agendado: 0,
    totalGalerias: 0,
    totalFotosExtras: 0,
    faturamentoExtras: 0,
    sessaoEmAndamento: false,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isInitialLoadRef = useRef(true);

  const calculateMetrics = useCallback(async () => {
    if (!clienteId) return;

    try {
      if (isInitialLoadRef.current) {
        setLoading(true);
      }
      setError(null);

      // 1. Get appointments count
      const { count: appointmentsCount } = await supabase
        .from('appointments')
        .select('*', { count: 'exact', head: true })
        .eq('cliente_id', clienteId);

      // 2. Get sessions data with aggregations
      const { data: sessionsData, error: sessionsError } = await supabase
        .from('clientes_sessoes')
        .select('id, session_id, valor_total, valor_pago, data_sessao, status, valor_total_foto_extra')
        .eq('cliente_id', clienteId);

      if (sessionsError) throw sessionsError;

      // 3. Get transactions for calculating scheduled amounts
      const { data: transacoesData, error: transacoesError } = await supabase
        .from('clientes_transacoes')
        .select('valor, tipo')
        .eq('cliente_id', clienteId)
        .in('tipo', ['ajuste']);

      if (transacoesError) {
        console.warn('⚠️ Erro ao buscar transações agendadas:', transacoesError);
      }

      // 4. Get galleries data
      const { data: galeriasData, error: galeriasError } = await supabase
        .from('galerias')
        .select('id, session_id, fotos_incluidas, fotos_selecionadas, total_fotos_extras_vendidas, valor_extras, valor_total_vendido, status, status_pagamento, status_selecao')
        .eq('cliente_id', clienteId);

      if (galeriasError) {
        console.warn('⚠️ Erro ao buscar galerias para métricas:', galeriasError);
      }

      // 5. Get payments data from cobrancas
      const { data: cobrancasData, error: cobrancasError } = await supabase
        .from('cobrancas')
        .select('id, valor, status, galeria_id, session_id')
        .eq('cliente_id', clienteId)
        .in('status', ['pago', 'pago_manual']);

      if (cobrancasError) {
        console.warn('⚠️ Erro ao buscar cobranças para métricas:', cobrancasError);
      }

      // Calcular agendado (transações de ajuste pendentes)
      const totalAgendado = (transacoesData || [])
        .reduce((acc, t) => acc + (Number(t.valor) || 0), 0);

      // Sessões base
      const totalSessoes = sessionsData?.length || 0;
      let totalFaturadoSessoes = sessionsData?.reduce((sum, s) => sum + (Number(s.valor_total) || 0), 0) || 0;
      let totalPagoSessoes = sessionsData?.reduce((sum, s) => sum + (Number(s.valor_pago) || 0), 0) || 0;

      // Galerias e Fotos Extras
      const galerias = galeriasData || [];
      const totalGalerias = galerias.length;

      // Calcular total de fotos extras
      const totalFotosExtras = galerias.reduce((sum, g) => {
        const vendidas = Number(g.total_fotos_extras_vendidas) || 0;
        if (vendidas > 0) return sum + vendidas;
        const selecionadas = Number(g.fotos_selecionadas) || 0;
        const incluidas = Number(g.fotos_incluidas) || 0;
        return sum + Math.max(0, selecionadas - incluidas);
      }, 0);

      // Faturamento total em extras (valor vendido ou valor_extras das galerias)
      const faturamentoExtras = galerias.reduce((sum, g) => {
        const totalVendido = Number(g.valor_total_vendido) || 0;
        const valorExtras = Number(g.valor_extras) || 0;
        return sum + (totalVendido > 0 ? totalVendido : valorExtras);
      }, 0);

      // Galerias avulsas (que não possuem session_id associado a uma sessão existente de clientes_sessoes)
      const sessionIdsSet = new Set(
        (sessionsData || []).flatMap(s => [s.id, s.session_id].filter(Boolean))
      );

      let faturamentoAvulsoGalerias = 0;
      let pagoAvulsoGalerias = 0;

      galerias.forEach(g => {
        const isLinkedToSession = g.session_id && sessionIdsSet.has(g.session_id);
        if (!isLinkedToSession) {
          const valVendido = Number(g.valor_total_vendido) || Number(g.valor_extras) || 0;
          faturamentoAvulsoGalerias += valVendido;
          if (g.status_pagamento === 'pago') {
            pagoAvulsoGalerias += valVendido;
          }
        }
      });

      // Total faturado e pago consolidado
      const totalFaturado = totalFaturadoSessoes + faturamentoAvulsoGalerias;
      const totalPago = totalPagoSessoes + pagoAvulsoGalerias;
      const aReceber = Math.max(0, totalFaturado - totalPago);

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
        totalPago,
        aReceber,
        agendamentos: appointmentsCount || 0,
        agendado: totalAgendado,
        totalGalerias,
        totalFotosExtras,
        faturamentoExtras,
        ultimaSessao,
        sessaoEmAndamento,
      });

    } catch (err) {
      console.error('❌ Erro ao calcular métricas:', err);
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setLoading(false);
      isInitialLoadRef.current = false;
    }
  }, [clienteId]);

  // Real-time subscriptions for all related tables
  useEffect(() => {
    if (!clienteId) return;

    calculateMetrics();

    // Subscribe to appointments changes
    const appointmentsChannel = supabase
      .channel(`client-appointments-metrics-${clienteId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'appointments',
          filter: `cliente_id=eq.${clienteId}`,
        },
        () => calculateMetrics()
      )
      .subscribe();

    const sessionsChannel = supabase
      .channel(`client-sessions-metrics-${clienteId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'clientes_sessoes',
          filter: `cliente_id=eq.${clienteId}`,
        },
        () => calculateMetrics()
      )
      .subscribe();

    const transactionsChannel = supabase
      .channel(`client-transactions-metrics-${clienteId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'clientes_transacoes',
          filter: `cliente_id=eq.${clienteId}`,
        },
        () => calculateMetrics()
      )
      .subscribe();

    const galleriesChannel = supabase
      .channel(`client-galleries-metrics-${clienteId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'galerias',
          filter: `cliente_id=eq.${clienteId}`,
        },
        () => calculateMetrics()
      )
      .subscribe();

    const cobrancasChannel = supabase
      .channel(`client-cobrancas-metrics-${clienteId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'cobrancas',
          filter: `cliente_id=eq.${clienteId}`,
        },
        () => calculateMetrics()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(appointmentsChannel);
      supabase.removeChannel(sessionsChannel);
      supabase.removeChannel(transactionsChannel);
      supabase.removeChannel(galleriesChannel);
      supabase.removeChannel(cobrancasChannel);
    };
  }, [clienteId, calculateMetrics]);

  return {
    metrics,
    loading,
    error,
    refetch: calculateMetrics,
  };
}