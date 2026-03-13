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
  const isInitialLoadRef = useRef(true);

  const loadSessions = useCallback(async () => {
    if (!clienteId) {
      setSessions([]);
      setLoading(false);
      return;
    }

    try {
      // Only show spinner on initial load, not on realtime refetches
      if (isInitialLoadRef.current) {
        setLoading(true);
      }
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

      // Buscar transações/pagamentos + cobranças MP para cada sessão
      const sessionsWithPayments = await Promise.all(
        (sessionsData || []).map(async (session) => {
          // Buscar transações por AMBOS os session_id (texto e UUID)
          const { data: transacoesData, error: transacoesError } = await supabase
            .from('clientes_transacoes')
            .select('*')
            .or(`session_id.eq.${session.session_id},session_id.eq.${session.id}`)
            .eq('user_id', user.id)
            .in('tipo', ['pagamento', 'ajuste'])
            .order('data_transacao', { ascending: false });

          if (transacoesError) {
            console.warn('Erro ao buscar transações:', transacoesError);
          }

          // Buscar cobranças MP pagas para esta sessão
          const { data: cobrancasPagas } = await supabase
            .from('cobrancas')
            .select('*')
            .or(`session_id.eq.${session.session_id},session_id.eq.${session.id}`)
            .eq('user_id', user.id)
            .eq('status', 'pago')
            .order('data_pagamento', { ascending: false });

          const pagamentos: any[] = [];
          const addedIds = new Set<string>();

          // Converter transações para formato de pagamentos (incluir pendentes)
          for (const t of (transacoesData || [])) {
            const match = t.descricao?.match(/\[ID:([^\]]+)\]/);
            const paymentId = match ? match[1] : t.id;
            
            if (addedIds.has(paymentId)) continue;
            addedIds.add(paymentId);

            const isPaid = t.tipo === 'pagamento';
            const isPending = t.tipo === 'ajuste';

            const parcelaMatch = t.descricao?.match(/Parcela (\d+)\/(\d+)/);
            const numeroParcela = parcelaMatch ? parseInt(parcelaMatch[1]) : undefined;
            const totalParcelas = parcelaMatch ? parseInt(parcelaMatch[2]) : undefined;

            let tipo: 'pago' | 'agendado' | 'parcelado' = 'pago';
            if (isPending) {
              tipo = totalParcelas ? 'parcelado' : 'agendado';
            }

            let statusPagamento: 'pago' | 'pendente' | 'atrasado' = 'pago';
            if (isPending) {
              statusPagamento = 'pendente';
              if (t.data_vencimento) {
                const hoje = new Date();
                const vencimento = new Date(t.data_vencimento);
                if (vencimento < hoje) {
                  statusPagamento = 'atrasado';
                }
              }
            }

            // Detectar origem MP pela descrição
            const isMercadoPago = t.descricao?.toLowerCase().includes('mercado pago') || 
                                   t.descricao?.toLowerCase().includes('mp #') ||
                                   t.descricao?.toLowerCase().includes('pix -') ||
                                   t.descricao?.toLowerCase().includes('link -');

            pagamentos.push({
              id: paymentId,
              valor: Number(t.valor) || 0,
              data: isPaid ? t.data_transacao : '',
              dataVencimento: t.data_vencimento || undefined,
              createdAt: t.created_at || undefined, // Timestamp completo para ordenação
              forma_pagamento: '',
              observacoes: t.descricao?.replace(/\s*\[ID:[^\]]+\]/, '') || '',
              tipo,
              statusPagamento,
              numeroParcela,
              totalParcelas,
              origem: isMercadoPago ? 'mercadopago' : 'manual',
              editavel: !isMercadoPago && isPending
            });
          }

          // Adicionar cobranças MP pagas que não têm transação correspondente
          for (const c of (cobrancasPagas || [])) {
            const paymentId = `mp-${c.mp_payment_id || c.id}`;
            
            if (addedIds.has(paymentId)) continue;
            
            // Verificar se já existe transação correspondente
            const hasMatchingTransaction = transacoesData?.some(t => 
              t.descricao?.includes(`MP #${c.mp_payment_id}`) ||
              (t.valor === c.valor && t.data_transacao === c.data_pagamento?.split('T')[0])
            );
            
            if (hasMatchingTransaction) continue;
            
            addedIds.add(paymentId);

            pagamentos.push({
              id: paymentId,
              valor: Number(c.valor) || 0,
              data: c.data_pagamento ? c.data_pagamento.split('T')[0] : '',
              forma_pagamento: c.tipo_cobranca === 'pix' ? 'Pix' : 'Link',
              observacoes: `${c.tipo_cobranca === 'pix' ? 'Pix' : 'Link'} Mercado Pago${c.descricao ? ` - ${c.descricao}` : ''}`,
              tipo: 'pago' as const,
              statusPagamento: 'pago' as const,
              origem: 'mercadopago',
              editavel: false
            });
          }

          // Ordenar pagamentos por timestamp decrescente (mais recente primeiro)
          // Prioriza createdAt (timestamp completo) para ordenação precisa
          pagamentos.sort((a, b) => {
            const timestampA = a.createdAt || a.data || a.dataVencimento || '';
            const timestampB = b.createdAt || b.data || b.dataVencimento || '';
            return timestampB.localeCompare(timestampA);
          });

          // ✅ FASE 5: Validação visual - detectar pacote vazio
          if (!session.pacote || session.pacote === '') {
            console.warn('⚠️ [CRM] Sessão sem pacote definido:', {
              sessionId: session.session_id,
              appointmentId: session.appointment_id,
              categoria: session.categoria,
              valorBasePacote: session.valor_base_pacote
            });
          }

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
      isInitialLoadRef.current = false;
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
    }, 500); // 500ms debounce to handle cascaded operations
  }, [loadSessions]);

  // Configurar realtime subscriptions
  useEffect(() => {
    if (!clienteId) return;

    let sessionsChannel: any = null;
    let transactionsChannel: any = null;

    const setupRealtime = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Subscribe to sessions changes (incluindo atualizações de valor_pago)
      sessionsChannel = supabase
        .channel(`client_sessions_realtime_${clienteId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'clientes_sessoes',
            filter: `cliente_id=eq.${clienteId}`,
          },
          (payload) => {
            console.log('🔄 Sessão alterada (CRM):', payload.eventType);
            debouncedRefetch();
          }
        )
        .subscribe();

      // Subscribe to transactions changes
      transactionsChannel = supabase
        .channel(`client_transactions_realtime_${clienteId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'clientes_transacoes',
            filter: `cliente_id=eq.${clienteId}`,
          },
          (payload) => {
            console.log('🔄 Transação alterada (CRM):', payload.eventType);
            debouncedRefetch();
          }
        )
        .subscribe();
    };

    setupRealtime();

    // ✅ Listener para evento payment-created (sincronização bidirecional)
    const handlePaymentCreated = () => {
      console.log('💰 [CRM] Received payment-created event, refetching...');
      debouncedRefetch();
    };
    window.addEventListener('payment-created', handlePaymentCreated as any);

    return () => {
      if (refetchTimerRef.current) {
        clearTimeout(refetchTimerRef.current);
      }
      if (sessionsChannel) supabase.removeChannel(sessionsChannel);
      if (transactionsChannel) supabase.removeChannel(transactionsChannel);
      window.removeEventListener('payment-created', handlePaymentCreated as any);
    };
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
