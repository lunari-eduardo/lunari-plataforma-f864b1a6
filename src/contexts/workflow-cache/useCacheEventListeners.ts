import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { eventBus } from '@/shared/event-bus';
import { WorkflowSession } from '@/features/workflow';
import { executeOptimisticPayment } from './cacheOperations';

interface UseCacheEventListenersProps {
  userId: string | null;
  memoryCache: React.MutableRefObject<Map<string, WorkflowSession[]>>;
  mergeUpdate: (session: WorkflowSession) => void;
  removeSession: (sessionId: string) => void;
  setMonthData: (year: number, month: number, sessions: WorkflowSession[]) => void;
  invalidateMonth: (year: number, month: number) => Promise<void>;
  silentRefreshMonth: (year: number, month: number, force?: boolean) => Promise<void>;
}

export const useCacheEventListeners = ({
  userId,
  memoryCache,
  mergeUpdate,
  removeSession,
  setMonthData,
  invalidateMonth,
  silentRefreshMonth,
}: UseCacheEventListenersProps) => {
  // Onda 4b — Bridge EventBus: workflow.card_deleted
  useEffect(() => {
    const off = eventBus.on('workflow.card_deleted', (event) => {
      const sessionId = event.payload?.sessionId;
      if (!sessionId) return;
      console.log('🛰️ [WorkflowCache] event workflow.card_deleted →', sessionId, event.payload.action);
      removeSession(sessionId);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('workflow-session-deleted', {
            detail: { sessionId, action: event.payload.action, source: 'event-bus' },
          }),
        );
      }
    });
    return off;
  }, [removeSession]);

  // FASE 4: Listen for custom cache merge events with client hydration
  useEffect(() => {
    const handleMergeEvent = async (event: CustomEvent) => {
      const session = event.detail?.session;
      if (!session) return;

      console.log('📥 [WorkflowCache] Received merge event from AppointmentSync:', session.id);

      // Se não tem dados do cliente, hidratar
      if (!session.clientes && session.cliente_id) {
        console.log('🔄 [CacheMerge] Hidratando dados do cliente...');
        const { data: fullSession } = await supabase
          .from('clientes_sessoes')
          .select(`*, clientes(nome)`)
          .eq('id', session.id)
          .single();

        if (fullSession) {
          mergeUpdate(fullSession as WorkflowSession);
          return;
        }
      }

      mergeUpdate(session);
    };

    window.addEventListener('workflow-cache-merge', handleMergeEvent as EventListener);
    return () => window.removeEventListener('workflow-cache-merge', handleMergeEvent as EventListener);
  }, [mergeUpdate]);

  // FASE 5: Listen for cache invalidation events
  useEffect(() => {
    const handleInvalidate = async (event: CustomEvent) => {
      const { year, month } = event.detail;
      console.log('🗑️ [WorkflowCache] Invalidating cache for:', year, month);
      await invalidateMonth(year, month);
    };

    window.addEventListener('workflow-cache-invalidate', handleInvalidate as EventListener);
    return () => window.removeEventListener('workflow-cache-invalidate', handleInvalidate as EventListener);
  }, [invalidateMonth]);

  // SILENT REFRESH LISTENER
  useEffect(() => {
    const handleSilentRefresh = async (event: CustomEvent) => {
      const { year, month, force } = event.detail ?? {};
      console.log('🔇 [WorkflowCache] Silent refresh event for:', year, month, { force: !!force });
      if (typeof year === 'number' && typeof month === 'number') {
        await silentRefreshMonth(year, month, !!force);
      } else {
        for (const key of memoryCache.current.keys()) {
          const [y, m] = key.split('-').map(Number);
          if (!isNaN(y) && !isNaN(m)) {
            void silentRefreshMonth(y, m, !!force);
          }
        }
      }
    };

    window.addEventListener('workflow-cache-silent-refresh', handleSilentRefresh as EventListener);
    return () => window.removeEventListener('workflow-cache-silent-refresh', handleSilentRefresh as EventListener);
  }, [silentRefreshMonth, memoryCache]);

  // Listener otimista: atualiza valor_pago localmente ANTES do round-trip ao DB (UI instantânea)
  useEffect(() => {
    const handleOptimistic = (event: CustomEvent) => {
      const { sessionId, delta } = event.detail || {};
      if (!sessionId || typeof delta !== 'number') return;
      executeOptimisticPayment(memoryCache.current, sessionId, delta, setMonthData);
    };

    window.addEventListener('payment-optimistic' as any, handleOptimistic);
    return () => window.removeEventListener('payment-optimistic' as any, handleOptimistic);
  }, [memoryCache, setMonthData]);

  // Listener autoritativo: busca valor_pago real recalculado pelo trigger SQL
  useEffect(() => {
    if (!userId) return;

    const handlePaymentCreated = async (event: CustomEvent) => {
      const { sessionId } = event.detail || {};
      if (!sessionId) return;
      console.log('💰 [WorkflowCache] payment-created event:', sessionId);

      // Pequena espera inicial para o trigger SQL (reduzida de 350 → 120ms)
      await new Promise((resolve) => setTimeout(resolve, 120));

      const fetchSession = async () => {
        const byText = await supabase
          .from('clientes_sessoes')
          .select('*, clientes(nome)')
          .eq('session_id', sessionId)
          .maybeSingle();
        if (byText.data) return byText.data;

        const byUuid = await supabase
          .from('clientes_sessoes')
          .select('*, clientes(nome)')
          .eq('id', sessionId)
          .maybeSingle();
        return byUuid.data;
      };

      let fullSession = await fetchSession();

      if (!fullSession) {
        await new Promise((resolve) => setTimeout(resolve, 180));
        fullSession = await fetchSession();
      }

      if (fullSession) {
        console.log('✅ [WorkflowCache] Sessão atualizada:', fullSession.id, 'valor_pago:', fullSession.valor_pago);
        mergeUpdate(fullSession as WorkflowSession);
        window.dispatchEvent(
          new CustomEvent('workflow-session-financials-stale', {
            detail: { sessionId: (fullSession as any).id },
          }),
        );
      } else {
        console.warn('⚠️ [WorkflowCache] Sessão não encontrada para sessionId:', sessionId);
      }
    };

    window.addEventListener('payment-created' as any, handlePaymentCreated);
    return () => window.removeEventListener('payment-created' as any, handlePaymentCreated);
  }, [userId, mergeUpdate]);
};
