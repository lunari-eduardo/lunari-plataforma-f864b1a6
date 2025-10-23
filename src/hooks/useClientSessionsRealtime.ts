import { useState, useEffect, useCallback, useRef } from 'react';
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
  
  // FASE 5: Debounce timer para refetch
  const refetchTimerRef = useRef<NodeJS.Timeout | null>(null);

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
            .in('tipo', ['pagamento', 'ajuste'])
            .order('data_transacao', { ascending: false });

          if (transacoesError) {
            console.warn('Erro ao buscar transações:', transacoesError);
          }

          // Converter transações para formato de pagamentos (incluir pendentes)
          const pagamentos = (transacoesData || []).map(t => {
            // Extrair paymentId do [ID:...] na descrição, senão usar UUID do Supabase
            const match = t.descricao?.match(/\[ID:([^\]]+)\]/);
            const paymentId = match ? match[1] : t.id;

            // Determinar se é pago ou pendente
            const isPaid = t.tipo === 'pagamento';
            const isPending = t.tipo === 'ajuste';

            // Extrair número da parcela se existir (ex: "Parcela 2/3")
            const parcelaMatch = t.descricao?.match(/Parcela (\d+)\/(\d+)/);
            const numeroParcela = parcelaMatch ? parseInt(parcelaMatch[1]) : undefined;
            const totalParcelas = parcelaMatch ? parseInt(parcelaMatch[2]) : undefined;

            // Determinar tipo de pagamento
            let tipo: 'pago' | 'agendado' | 'parcelado' = 'pago';
            if (isPending) {
              tipo = totalParcelas ? 'parcelado' : 'agendado';
            }

            // Determinar status
            let statusPagamento: 'pago' | 'pendente' | 'atrasado' = 'pago';
            if (isPending) {
              statusPagamento = 'pendente';
              // Verificar se está atrasado
              if (t.data_vencimento) {
                const hoje = new Date();
                const vencimento = new Date(t.data_vencimento);
                if (vencimento < hoje) {
                  statusPagamento = 'atrasado';
                }
              }
            }

            return {
              id: paymentId,
              valor: Number(t.valor) || 0,
              data: isPaid ? t.data_transacao : '',
              dataVencimento: t.data_vencimento || undefined,
              forma_pagamento: '',
              observacoes: t.descricao?.replace(/\s*\[ID:[^\]]+\]/, '') || '',
              tipo,
              statusPagamento,
              numeroParcela,
              totalParcelas,
              origem: 'manual' as const,
              editavel: true
            };
          });

          // FASE 2: Read valor_base_pacote with intelligent fallback
          let valorPacote = Number(session.valor_base_pacote) || 0;
          
          // FASE 2: Fallback chain if valor_base_pacote is 0
          if (valorPacote === 0) {
            const regrasCongeladas = session.regras_congeladas as any;
            
            // 1º fallback: regras_congeladas.valorBase (CONFIÁVEL)
            if (regrasCongeladas?.valorBase && Number(regrasCongeladas.valorBase) > 0) {
              valorPacote = Number(regrasCongeladas.valorBase);
              console.log('💰 [CRM] Usando regras_congeladas.valorBase:', valorPacote);
            }
            // 2º fallback: Calcular por subtração (MELHOR que usar valor_total direto)
            else if (session.valor_total && session.valor_total > 0) {
              const total = Number(session.valor_total);
              const fotoExtra = Number(session.valor_total_foto_extra) || 0;
              const adicional = Number(session.valor_adicional) || 0;
              const desconto = Number(session.desconto) || 0;
              
              // Calcular produtos manuais ANTES de usar
              const produtosListTemp = Array.isArray(session.produtos_incluidos) 
                ? session.produtos_incluidos : [];
              let valorProdutosTemp = 0;
              for (const p of produtosListTemp) {
                const prod = p as any;
                if (prod.tipo === 'manual') {
                  valorProdutosTemp += (Number(prod.valorUnitario) || 0) * (Number(prod.quantidade) || 0);
                }
              }
              
              // valor_base_pacote = total - fotos - produtos - adicional + desconto
              const soma = total - fotoExtra - valorProdutosTemp - adicional;
              valorPacote = Math.max(0, soma + desconto);
              console.log('💰 [CRM] Calculado por subtração:', valorPacote, {
                total, fotoExtra, valorProdutosTemp, adicional, desconto
              });
            } 
            else {
              console.warn('⚠️ [CRM] Não foi possível determinar valor_base_pacote:', session.id);
            }
          }
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

          // Calcular total agendado: soma dos ajustes (pendentes)
          const totalAgendado = (transacoesData || [])
            .filter(t => t.tipo === 'ajuste')
            .reduce((acc, t) => acc + (Number(t.valor) || 0), 0);

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

  // FASE 5: Debounced refetch para evitar race conditions
  const debouncedRefetch = useCallback(() => {
    if (refetchTimerRef.current) {
      clearTimeout(refetchTimerRef.current);
    }
    
    refetchTimerRef.current = setTimeout(() => {
      console.log('🔄 [Debounced] Recarregando sessões do cliente...');
      loadSessions();
    }, 150); // 150ms debounce
  }, [loadSessions]);

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
            console.log('🔄 Sessão alterada, usando debounce...');
            debouncedRefetch();
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
            console.log('🔄 Transação alterada, usando debounce...');
            debouncedRefetch();
          }
        )
        .subscribe();

      return () => {
        if (refetchTimerRef.current) {
          clearTimeout(refetchTimerRef.current);
        }
        supabase.removeChannel(sessionsChannel);
        supabase.removeChannel(transactionsChannel);
      };
    };

    setupRealtime();
  }, [clienteId, debouncedRefetch]);

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
