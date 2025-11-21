/**
 * useWorkflowData - Hook consolidado para dados do Workflow
 * 
 * Integra cache inteligente + realtime + Supabase
 * 
 * Features:
 * - Cache-first loading (< 100ms)
 * - Background refresh automático
 * - Real-time updates via Supabase
 * - Cross-tab sync via BroadcastChannel
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { WorkflowSession } from '@/hooks/useWorkflowRealtime';
import { workflowCacheManager } from '@/services/WorkflowCacheManager';
import { realtimeSubscriptionManager } from '@/services/RealtimeSubscriptionManager';

interface UseWorkflowDataOptions {
  year: number;
  month: number;
  enableRealtime?: boolean;
  autoPreload?: boolean;
}

export function useWorkflowData(options: UseWorkflowDataOptions) {
  const { year, month, enableRealtime = true, autoPreload = true } = options;
  
  const [sessions, setSessions] = useState<WorkflowSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [cacheHit, setCacheHit] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isInitialMount = useRef(true);
  const userIdRef = useRef<string | null>(null);

  /**
   * Carrega dados (cache-first) - usado para refresh manual
   */
  const loadData = useCallback(async (forceRefresh = false) => {
    try {
      setLoading(true);
      setError(null);

      // 1. Tentar cache primeiro (síncrono) se não forçar refresh
      if (!forceRefresh) {
        const cached = workflowCacheManager.getSessionsForMonthSync(year, month);
        if (cached !== null) {
          setSessions(cached);
          setCacheHit(true);
          setLoading(false);
          console.log(`⚡ useWorkflowData: Cache hit for ${year}-${month} (${cached.length} sessions)`);
          return;
        }
      }

      // 2. Buscar do Supabase
      setCacheHit(false);
      const freshSessions = await workflowCacheManager.fetchFromSupabaseAndCache(year, month);
      setSessions(freshSessions);
      console.log(`🔄 useWorkflowData: Fresh data loaded for ${year}-${month} (${freshSessions.length} sessions)`);
      
    } catch (err) {
      console.error('❌ useWorkflowData: Error loading data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load workflow data');
    } finally {
      setLoading(false);
    }
  }, [year, month]);

  /**
   * Setup inicial e autenticação
   */
  useEffect(() => {
    const initUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        userIdRef.current = user.id;
        // Apenas garantir que userId está configurado (preload é feito no useWorkflowCacheInit)
        workflowCacheManager.setUserId(user.id);
      }
    };

    initUser();
  }, []);

  // Carregar dados com estratégia cache-first otimizada
  useEffect(() => {
    let isMounted = true;
    
    const loadDataSmart = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // 1️⃣ Tentar cache síncrono PRIMEIRO (< 1ms)
        const cachedSync = workflowCacheManager.getSessionsForMonthSync(year, month);
        if (cachedSync !== null) {
          // ✅ VALIDAR INTEGRIDADE DO CACHE
          const primeiraSessionIncompleta = cachedSync.find(s => 
            s.regras_congeladas === null || 
            s.regras_congeladas === undefined
          );
          
          if (primeiraSessionIncompleta && cachedSync.length > 0) {
            console.warn('⚠️ Cache incompleto detectado, forçando reload do Supabase');
            // Invalidar cache e recarregar
            workflowCacheManager.invalidateMonth(year, month);
            const freshSessions = await workflowCacheManager.fetchFromSupabaseAndCache(year, month);
            if (isMounted) {
              setSessions(freshSessions);
              setCacheHit(false);
              setLoading(false);
            }
            return;
          }
          
          // Cache OK, usar normalmente
          if (isMounted) {
            setSessions(cachedSync);
            setCacheHit(true);
            setLoading(false);
            console.log(`⚡ useWorkflowData: Instant cache hit for ${year}-${month} (${cachedSync.length} sessions)`);
          }
          return;
        }
        
        // 2️⃣ Não tem cache? Buscar direto do Supabase (sem esperar preload)
        console.log(`🔄 useWorkflowData: No cache, fetching from Supabase for ${year}-${month}`);
        setCacheHit(false);
        const freshSessions = await workflowCacheManager.fetchFromSupabaseAndCache(year, month);
        if (isMounted) {
          setSessions(freshSessions);
          setLoading(false);
        }
        
      } catch (err) {
        console.error('❌ useWorkflowData: Error loading data:', err);
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Failed to load workflow data');
          setLoading(false);
        }
      }
    };
    
    loadDataSmart();
    
    return () => {
      isMounted = false;
    };
  }, [year, month]);

  /**
   * Subscribe para atualizações do cache manager
   */
  useEffect(() => {
    const unsubscribe = workflowCacheManager.subscribe((updatedSessions) => {
      // Filtrar para o mês atual
      const filtered = updatedSessions.filter(session => {
        const sessionDate = new Date(session.data_sessao);
        return sessionDate.getFullYear() === year && 
               sessionDate.getMonth() + 1 === month;
      });
      
      // ✅ FASE 1: SEMPRE atualizar estado (mesmo com array vazio ou 1 item)
      setSessions(filtered);
      console.log(`🔔 useWorkflowData: Cache updated, ${filtered.length} sessions for ${year}-${month}`);
    });

    return unsubscribe;
  }, [year, month]);

  /**
   * Setup realtime subscriptions
   */
  useEffect(() => {
    if (!enableRealtime || !userIdRef.current) return;

    console.log(`📡 useWorkflowData: Setting up realtime for ${year}-${month}`);

    // Subscribe para clientes_sessoes
    const unsubscribeSessions = realtimeSubscriptionManager.subscribe(
      'clientes_sessoes',
      {
        onInsert: (payload) => {
          console.log('🆕 useWorkflowData: New session inserted', payload.new);
          const newSession = payload.new as WorkflowSession;
          
          // ✅ FASE 4: Logs detalhados para debug
          const sessionDate = new Date(newSession.data_sessao);
          const belongsToCurrentMonth = sessionDate.getFullYear() === year && 
                                         sessionDate.getMonth() + 1 === month;
          
          console.log(`📅 Session date: ${newSession.data_sessao}, Current view: ${year}-${month}, Belongs: ${belongsToCurrentMonth}`);
          
          if (belongsToCurrentMonth) {
            workflowCacheManager.addSession(newSession);
            console.log('✅ Session added to cache for current month');
          } else {
            console.log('⏭️ Session skipped - belongs to different month');
          }
        },
        onUpdate: (payload) => {
          console.log('📝 useWorkflowData: Session updated', payload.new);
          const updatedSession = payload.new as WorkflowSession;
          workflowCacheManager.updateSession(updatedSession.id, updatedSession);
        },
        onDelete: (payload) => {
          console.log('🗑️ useWorkflowData: Session deleted', payload.old);
          workflowCacheManager.removeSession(payload.old.id);
        }
      },
      `workflow-data-${year}-${month}`
    );

    // Subscribe para clientes_transacoes (pagamentos)
    const unsubscribeTransactions = realtimeSubscriptionManager.subscribe(
      'clientes_transacoes',
      {
        onInsert: (payload) => {
          console.log('💰 useWorkflowData: Payment inserted', payload.new);
          // Recarregar sessão afetada para atualizar valor_pago
          if (payload.new.session_id) {
            loadData(true);
          }
        },
        onUpdate: (payload) => {
          console.log('💰 useWorkflowData: Payment updated', payload.new);
          if (payload.new.session_id) {
            loadData(true);
          }
        },
        onDelete: (payload) => {
          console.log('💰 useWorkflowData: Payment deleted', payload.old);
          if (payload.old.session_id) {
            loadData(true);
          }
        }
      },
      `workflow-transactions-${year}-${month}`
    );

    return () => {
      console.log(`📡 useWorkflowData: Cleaning up realtime for ${year}-${month}`);
      unsubscribeSessions.then(id => {
        if (id) realtimeSubscriptionManager.unsubscribe('clientes_sessoes', id);
      });
      unsubscribeTransactions.then(id => {
        if (id) realtimeSubscriptionManager.unsubscribe('clientes_transacoes', id);
      });
    };
  }, [year, month, enableRealtime, loadData]);

  /**
   * ✅ FASE 4: Listener para evento de criação de sessão
   */
  useEffect(() => {
    const handleSessionCreated = (event: CustomEvent) => {
      console.log('📢 [useWorkflowData] Received workflow-session-created event:', event.detail);
      // Forçar reload para garantir que a UI atualiza
      loadData(true);
    };

    window.addEventListener('workflow-session-created' as any, handleSessionCreated);
    
    return () => {
      window.removeEventListener('workflow-session-created' as any, handleSessionCreated);
    };
  }, [loadData]);

  /**
   * Refresh manual
   */
  const refresh = useCallback(() => {
    console.log(`🔄 useWorkflowData: Manual refresh for ${year}-${month}`);
    return loadData(true);
  }, [loadData]);

  return {
    sessions,
    loading,
    cacheHit,
    error,
    refresh
  };
}
