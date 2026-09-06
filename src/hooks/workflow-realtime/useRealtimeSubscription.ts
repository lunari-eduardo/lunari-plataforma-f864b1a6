import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { isWorkflowRealtimeV2Enabled } from '@/features/workflow/realtime';
import { WorkflowSession } from './types';

interface UseRealtimeSubscriptionProps {
  setSessions: React.Dispatch<React.SetStateAction<WorkflowSession[]>>;
  loadSessions: () => Promise<void>;
}

export const useRealtimeSubscription = ({
  setSessions,
  loadSessions,
}: UseRealtimeSubscriptionProps) => {
  useEffect(() => {
    loadSessions();

    let channel: any = null;

    const setupRealtimeChannel = async () => {
      // Onda 3: canal unificado v2 assume eventos. Legado fica desligado
      // para evitar duplicação e eco.
      if (isWorkflowRealtimeV2Enabled()) {
        console.log('[useWorkflowRealtime] canal legado desativado (v2 ON)');
        return;
      }
      const {
        data: { session: authSession },
      } = await supabase.auth.getSession();
      const user = authSession?.user;
      if (!user?.id) {
        console.warn('⚠️ [WorkflowRealtime] Sem user_id para filtrar real-time');
        return;
      }

      channel = supabase
        .channel(`workflow-sessions-${user.id}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'clientes_sessoes',
            filter: `user_id=eq.${user.id}`,
          },
          async (payload) => {
            console.log('🔄 [WorkflowRealtime] Real-time workflow session change:', payload.eventType);

            if (payload.eventType === 'INSERT') {
              console.log('➕ [WorkflowRealtime] Adding new session via realtime:', payload.new);

              const { data: enrichedSession } = await supabase
                .from('clientes_sessoes')
                .select(`
                  *,
                  clientes (
                    nome,
                    email,
                    telefone,
                    whatsapp
                  )
                `)
                .eq('id', (payload.new as any).id)
                .single();

              if (enrichedSession) {
                console.log('✅ [WorkflowRealtime] Sessão enriquecida com cliente:', (enrichedSession as any).clientes?.nome);
                setSessions((prev) => {
                  if (prev.some((s) => s.id === (enrichedSession as any).id)) return prev;
                  return [enrichedSession as unknown as WorkflowSession, ...prev];
                });
              } else {
                setSessions((prev) => {
                  if (prev.some((s) => s.id === (payload.new as any).id)) return prev;
                  return [payload.new as WorkflowSession, ...prev];
                });
              }
            } else if (payload.eventType === 'UPDATE') {
              console.log('✏️ [WorkflowRealtime] Updating session via realtime:', (payload.new as any).id);

              const newStatus = (payload.new as any).status;
              if (newStatus === 'historico') {
                console.log('🗃️ [WorkflowRealtime] Session marked as historical, removing from workflow:', (payload.new as any).id);
                setSessions((prev) => prev.filter((session) => session.id !== (payload.new as any).id));
                return;
              }

              const sessionId = (payload.new as any).session_id;
              if (sessionId) {
                const { data: transacoesData } = await supabase
                  .from('clientes_transacoes')
                  .select('*')
                  .eq('session_id', sessionId)
                  .eq('user_id', user.id)
                  .in('tipo', ['pagamento', 'ajuste'])
                  .order('data_transacao', { ascending: false });

                const pagamentos = (transacoesData || []).map((t) => {
                  const match = t.descricao?.match(/\[ID:([^\]]+)\]/);
                  const paymentId = match ? match[1] : t.id;
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
                    if (t.data_vencimento && new Date(t.data_vencimento) < new Date()) {
                      statusPagamento = 'atrasado';
                    }
                  }

                  return {
                    id: paymentId,
                    valor: Number(t.valor) || 0,
                    data: isPaid ? t.data_transacao : '',
                    dataVencimento: t.data_vencimento || undefined,
                    observacoes: t.descricao?.replace(/\s*\[ID:[^\]]+\]/, '') || '',
                    tipo,
                    statusPagamento,
                    numeroParcela,
                    totalParcelas,
                    origem: 'manual' as const,
                    editavel: true,
                  };
                });

                setSessions((prev) =>
                  prev.map((session: any) => {
                    if (session.id !== (payload.new as any).id) return session;
                    const incoming = payload.new as any;
                    const preservedCliente =
                      session?.clientes && !('clientes' in incoming) ? session.clientes : incoming?.clientes;
                    return {
                      ...session,
                      ...incoming,
                      pagamentos,
                      ...(preservedCliente ? { clientes: preservedCliente } : {}),
                    } as WorkflowSession;
                  }),
                );
                return;
              }

              setSessions((prev) =>
                prev.map((session: any) => {
                  if (session.id !== (payload.new as any).id) return session;
                  const incoming = payload.new as any;
                  const preservedCliente =
                    session?.clientes && !('clientes' in incoming) ? session.clientes : incoming?.clientes;
                  return {
                    ...session,
                    ...incoming,
                    ...(preservedCliente ? { clientes: preservedCliente } : {}),
                  } as WorkflowSession;
                }),
              );
            } else if (payload.eventType === 'DELETE') {
              console.log('🗑️ [WorkflowRealtime] Deleting session via realtime:', (payload.old as any).id);
              setSessions((prev) => prev.filter((session) => session.id !== (payload.old as any).id));
            }
          },
        )
        .subscribe();
    };

    setupRealtimeChannel();

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [loadSessions, setSessions]);
};
