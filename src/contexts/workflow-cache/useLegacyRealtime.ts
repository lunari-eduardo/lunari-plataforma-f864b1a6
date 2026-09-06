import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { WorkflowSession } from '@/features/workflow';
import { isWorkflowRealtimeV2Enabled } from '@/features/workflow/realtime';
import { getYearMonthFromDateString } from './types';

interface UseLegacyRealtimeProps {
  userId: string | null;
  memoryCache: React.MutableRefObject<Map<string, WorkflowSession[]>>;
  mergeUpdate: (session: WorkflowSession) => void;
  removeSession: (sessionId: string) => void;
}

export const useLegacyRealtime = ({
  userId,
  memoryCache,
  mergeUpdate,
  removeSession,
}: UseLegacyRealtimeProps) => {
  useEffect(() => {
    if (!userId) return;

    // Onda 3: quando o canal unificado (`workflow:user:{userId}`) está ativo,
    // este canal legado fica desligado para evitar dupla-hidratação/eco.
    if (isWorkflowRealtimeV2Enabled()) {
      console.log('[WorkflowCacheContext] realtime legado desativado (v2 ON)');
      return;
    }

    // FASE 3: Debounce para reduzir updates excessivos e flickering
    let realtimeDebounce: NodeJS.Timeout | null = null;

    const channel = supabase
      .channel('workflow-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'clientes_sessoes',
          filter: `user_id=eq.${userId}`,
        },
        async (payload) => {
          console.log('📡 Realtime event (sessoes):', payload.eventType, (payload.new as any)?.id);

          // FASE 6: Para INSERT, processar imediatamente (sem debounce)
          // Para UPDATE/DELETE, usar debounce reduzido de 150ms
          if (payload.eventType === 'INSERT') {
            const session = payload.new as WorkflowSession;
            console.log('🆕 [Realtime] INSERT detectado, processando imediatamente...');

            // Verificar se já existe no cache (evitar duplicação com merge otimista)
            // Parse direto da string para evitar bug de timezone
            const { year, month } = getYearMonthFromDateString(session.data_sessao);
            const key = `${year}-${String(month).padStart(2, '0')}`;
            const existingSessions = memoryCache.current.get(key) || [];

            if (existingSessions.some((s) => s.id === session.id)) {
              console.log('⚠️ [Realtime] INSERT: sessão já existe no cache, atualizando...');
            }

            const { data: fullSession } = await supabase
              .from('clientes_sessoes')
              .select(`*, clientes(nome)`)
              .eq('id', session.id)
              .single();

            if (fullSession) {
              console.log('✅ [Realtime] Sessão nova inserida:', fullSession.id);
              mergeUpdate(fullSession as WorkflowSession);
            } else {
              console.log('⚠️ [Realtime] INSERT: usando payload como fallback');
              mergeUpdate(session);
            }
          } else {
            // UPDATE/DELETE com debounce reduzido
            if (realtimeDebounce) clearTimeout(realtimeDebounce);

            realtimeDebounce = setTimeout(async () => {
              if (payload.eventType === 'UPDATE') {
                const session = payload.new as WorkflowSession;

                console.log('🔄 [Realtime] Buscando sessão completa após UPDATE...');
                const { data: fullSession } = await supabase
                  .from('clientes_sessoes')
                  .select(`*, clientes(nome)`)
                  .eq('id', session.id)
                  .single();

                if (fullSession) {
                  console.log('✅ [Realtime] Sessão atualizada:', fullSession.id);
                  mergeUpdate(fullSession as WorkflowSession);
                } else {
                  mergeUpdate(session);
                }
              }
              if (payload.eventType === 'DELETE' && payload.old) {
                removeSession((payload.old as any).id);
              }
            }, 150);
          }
        },
      )
      // FASE 1: Subscription para clientes_transacoes (pagamentos)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'clientes_transacoes',
          filter: `user_id=eq.${userId}`,
        },
        async (payload) => {
          console.log('💰 Realtime event (transacoes):', payload.eventType);

          // Quando pagamento muda, buscar a sessão atualizada com valor_pago recalculado
          const sessionId = (payload.new as any)?.session_id || (payload.old as any)?.session_id;
          if (sessionId) {
            // Delay aumentado para garantir que trigger do DB calculou valor_pago
            setTimeout(async () => {
              const { data: updatedSession } = await supabase
                .from('clientes_sessoes')
                .select(`*, clientes(nome)`)
                .eq('session_id', sessionId)
                .single();

              if (updatedSession) {
                console.log('💰 [Realtime] Sessão atualizada após pagamento:', updatedSession.id, 'valor_pago:', updatedSession.valor_pago);
                mergeUpdate(updatedSession as WorkflowSession);
              }
            }, 350);
          }
        },
      )
      .subscribe((status) => {
        console.log('📡 [Realtime] Subscription status:', status);
        if (status === 'SUBSCRIBED') {
          console.log('✅ [Realtime] Successfully subscribed to clientes_sessoes & clientes_transacoes');
        } else if (status === 'CHANNEL_ERROR') {
          console.error('❌ [Realtime] Subscription error - may need retry');
        } else if (status === 'TIMED_OUT') {
          console.warn('⚠️ [Realtime] Subscription timed out - reconnecting...');
        }
      });

    return () => {
      console.log('🔌 [Realtime] Cleaning up subscription');
      if (realtimeDebounce) clearTimeout(realtimeDebounce);
      supabase.removeChannel(channel);
    };
  }, [userId, memoryCache, mergeUpdate, removeSession]);
};
