import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface ClientSession {
  id: string;
  sessionId: string;
  data: string;
  hora: string;
  categoria: string;
  pacote?: string;
  descricao?: string;
  status: string;
  valorPacote: number;
  valorTotalFotoExtra: number;
  valorTotalProduto: number;
  valorAdicional: number;
  desconto: number;
  total: number;
  valorPago: number;
  restante: number;
  totalAgendado: number;
  produtosList: any[];
  pagamentos: any[];
  detalhes?: string;
  observacoes?: string;
}

export function useClientSessionsRealtime(clienteId: string) {
  const [sessions, setSessions] = useState<ClientSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadSessions = useCallback(async () => {
    if (!clienteId) {
      setSessions([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Buscar sessões do cliente
      const { data: sessionsData, error: sessionsError } = await supabase
        .from('clientes_sessoes')
        .select('*')
        .eq('cliente_id', clienteId)
        .eq('user_id', user.id)
        .order('data_sessao', { ascending: false });

      if (sessionsError) throw sessionsError;

      // Buscar transações/pagamentos para cada sessão
      const sessionsWithPayments = await Promise.all(
        (sessionsData || []).map(async (session) => {
          const { data: transacoesData, error: transacoesError } = await supabase
            .from('clientes_transacoes')
            .select('*')
            .eq('session_id', session.session_id)
            .eq('user_id', user.id)
            .order('data_transacao', { ascending: false });

          if (transacoesError) {
            console.warn('Erro ao buscar transações:', transacoesError);
          }

          // Converter transações para formato de pagamentos
          const pagamentos = (transacoesData || [])
            .filter(t => t.tipo === 'pagamento')
            .map(t => ({
              id: t.id,
              valor: Number(t.valor) || 0,
              data: t.data_transacao,
              forma_pagamento: '',
              observacoes: t.descricao || '',
              tipo: 'pago',
              statusPagamento: 'pago',
              origem: 'manual',
              editavel: true
            }));

          // FASE 3: Read valor_base_pacote directly from database
          const valorPacote = Number(session.valor_base_pacote) || 0;
          const valorTotalFotoExtra = Number(session.valor_total_foto_extra) || 0;
          const valorAdicional = Number(session.valor_adicional) || 0;
          const desconto = Number(session.desconto) || 0;
          const valorPago = Number(session.valor_pago) || 0;

          // Produtos do JSONB
          const produtosList = Array.isArray(session.produtos_incluidos) 
            ? session.produtos_incluidos 
            : [];

          // Calcular valor total dos produtos manuais
          const valorTotalProduto = produtosList.reduce((acc: number, p: any) => {
            if (p.tipo === 'manual') {
              const unitario = Number(p.valorUnitario) || 0;
              const qtd = Number(p.quantidade) || 0;
              return acc + (unitario * qtd);
            }
            return acc;
          }, 0);

          // FASE 3: Read valor_total directly from database (DON'T recalculate)
          const total = Number(session.valor_total) || 0;
          const restante = Math.max(0, total - valorPago);

          // Calcular total agendado: pagamentos pendentes (ainda não realizados)
          // Por enquanto, baseado apenas no restante, pois pagamentos agendados 
          // ainda não estão implementados em clientes_transacoes
          const totalAgendado = 0; // TODO: Implementar quando adicionar campo de data_vencimento em transações

          return {
            id: session.id,
            sessionId: session.session_id,
            data: session.data_sessao,
            hora: session.hora_sessao,
            categoria: session.categoria,
            pacote: session.pacote || '',
            descricao: session.descricao || '',
            status: session.status,
            valorPacote,
            valorTotalFotoExtra,
            valorTotalProduto: Number(valorTotalProduto) || 0,
            valorAdicional,
            desconto,
            total,
            valorPago,
            restante,
            totalAgendado,
            produtosList,
            pagamentos,
            detalhes: session.detalhes || '',
            observacoes: session.observacoes || ''
          } as ClientSession;
        })
      );

      setSessions(sessionsWithPayments);
      setError(null);

    } catch (error) {
      console.error('❌ Erro ao carregar sessões do cliente:', error);
      setError(error instanceof Error ? error.message : 'Erro desconhecido');
      toast.error('Erro ao carregar histórico de sessões');
    } finally {
      setLoading(false);
    }
  }, [clienteId]);

  // Configurar realtime subscriptions
  useEffect(() => {
    if (!clienteId) return;

    const setupRealtime = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Subscribe to sessions changes
      const sessionsChannel = supabase
        .channel('client_sessions_realtime')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'clientes_sessoes',
            filter: `cliente_id=eq.${clienteId}`,
          },
          () => {
            console.log('🔄 Sessão alterada, recarregando...');
            loadSessions();
          }
        )
        .subscribe();

      // Subscribe to transactions changes
      const transactionsChannel = supabase
        .channel('client_transactions_realtime')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'clientes_transacoes',
            filter: `cliente_id=eq.${clienteId}`,
          },
          () => {
            console.log('🔄 Transação alterada, recarregando...');
            loadSessions();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(sessionsChannel);
        supabase.removeChannel(transactionsChannel);
      };
    };

    setupRealtime();
  }, [clienteId, loadSessions]);

  // Carregar dados iniciais
  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  return {
    sessions,
    loading,
    error,
    refetch: loadSessions
  };
}
