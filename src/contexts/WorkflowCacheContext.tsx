import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { indexedDBCache } from '@/services/IndexedDBCache';
import { WorkflowSession } from '@/features/workflow';
import { normalizeWorkflowSession, normalizeWorkflowSessions, normalizeWorkflowSessionPartial } from '@/utils/workflowNormalization';
import { sessionsRepo } from '@/features/workflow/data';
import { workflowStore } from '@/features/workflow/store/workflowStore';
import { isWorkflowRealtimeV2Enabled } from '@/features/workflow/realtime';
import { eventBus } from '@/shared/event-bus';
import { prefetchMonthMetrics } from '@/features/workflow/data/metricsRepo';
import { metricsCache } from '@/features/workflow/data/metricsCache';
import '@/modules/workflow/domain/events';


// Helper para extrair ano/mês de string YYYY-MM-DD sem conversão de timezone
const getYearMonthFromDateString = (dateString: string): { year: number; month: number } => {
  if (!dateString || typeof dateString !== 'string') {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() + 1 };
  }
  const [year, month] = dateString.split('-').map(Number);
  return { year: year || new Date().getFullYear(), month: month || (new Date().getMonth() + 1) };
};

/**
 * Tranche 2 — MonthLoadStatus state machine
 * ------------------------------------------
 *  - idle    : nunca solicitado
 *  - loading : fetch cold em andamento (sem cache)
 *  - ready   : dados válidos + sem revalidação pendente
 *  - stale   : dados válidos + revalidação silenciosa em andamento
 *  - error   : último fetch falhou; UI pode oferecer retry
 */
export type MonthLoadStatus = 'idle' | 'loading' | 'ready' | 'stale' | 'error';

export interface MonthLoadState {
  status: MonthLoadStatus;
  error: string | null;
  loadedAt: number | null;
}

interface WorkflowCacheContextType {
  getSessionsForMonthSync: (year: number, month: number) => WorkflowSession[] | null;
  getAllCachedSessionsSync: () => WorkflowSession[];
  isPreloading: boolean;
  invalidateMonth: (year: number, month: number) => Promise<void>;
  setMonthData: (year: number, month: number, sessions: WorkflowSession[]) => void;
  mergeUpdate: (session: WorkflowSession) => void;
  removeSession: (sessionId: string) => void;
  subscribe: (callback: (sessions: WorkflowSession[]) => void) => () => void;
  forceRefresh: () => Promise<void>;
  ensureMonthLoaded: (year: number, month: number, forceRefresh?: boolean) => Promise<void>;
  isLoadingMonth: (year: number, month: number) => boolean;
  getMonthStatus: (year: number, month: number) => MonthLoadState;
  subscribeMonthStatus: (
    year: number,
    month: number,
    callback: (state: MonthLoadState) => void,
  ) => () => void;
  retryMonth: (year: number, month: number) => Promise<void>;
}

const WorkflowCacheContext = createContext<WorkflowCacheContextType | null>(null);

export const useWorkflowCache = () => {
  const context = useContext(WorkflowCacheContext);
  if (!context) {
    throw new Error('useWorkflowCache must be used within WorkflowCacheProvider');
  }
  return context;
};

export const WorkflowCacheProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [userId, setUserId] = useState<string | null>(null);
  const [isPreloading, setIsPreloading] = useState(false);
  
  // Cache em memória: Map<"YYYY-MM", WorkflowSession[]>
  const memoryCache = useRef<Map<string, WorkflowSession[]>>(new Map());
  const subscribers = useRef<Set<(sessions: WorkflowSession[]) => void>>(new Set());
  const broadcastChannel = useRef<BroadcastChannel | null>(null);
  // Ref usada por mergeUpdate para evitar ciclo de dependência com removeSession.
  const removeSessionRef = useRef<((sessionId: string) => void) | null>(null);
  // TTL do silent refresh — evita re-fetch em cascata (heartbeat/visibility/subscribe).
  const lastSilentRefreshAt = useRef<Map<string, number>>(new Map());
  const SILENT_REFRESH_TTL_MS = 60_000;
  // AbortController por mês: troca rápida cancela fetch antigo antes de disputar conexão PG.
  const monthAbortControllers = useRef<Map<string, AbortController>>(new Map());
  // Coalescing de notifySubscribers: microtask única para rajadas de setMonthData.
  const notifyPending = useRef(false);

  // Tranche 2 — state machine por mês + subscribers.
  const monthStateMap = useRef<Map<string, MonthLoadState>>(new Map());
  const monthStateSubs = useRef<Map<string, Set<(s: MonthLoadState) => void>>>(new Map());
  // Silent refresh in-flight (dedup independente do TTL).
  const silentInFlight = useRef<Map<string, Promise<void>>>(new Map());

  const DEFAULT_STATE: MonthLoadState = { status: 'idle', error: null, loadedAt: null };

  const setMonthState = useCallback((year: number, month: number, patch: Partial<MonthLoadState>) => {
    const key = getCacheKey(year, month);
    const prev = monthStateMap.current.get(key) ?? DEFAULT_STATE;
    const next: MonthLoadState = { ...prev, ...patch };
    if (
      next.status === prev.status &&
      next.error === prev.error &&
      next.loadedAt === prev.loadedAt
    ) return;
    monthStateMap.current.set(key, next);
    const subs = monthStateSubs.current.get(key);
    if (subs) subs.forEach((cb) => { try { cb(next); } catch { /* noop */ } });
  }, []);

  const getMonthStatus = useCallback((year: number, month: number): MonthLoadState => {
    return monthStateMap.current.get(getCacheKey(year, month)) ?? DEFAULT_STATE;
  }, []);

  const subscribeMonthStatus = useCallback(
    (year: number, month: number, cb: (s: MonthLoadState) => void) => {
      const key = getCacheKey(year, month);
      let set = monthStateSubs.current.get(key);
      if (!set) { set = new Set(); monthStateSubs.current.set(key, set); }
      set.add(cb);
      return () => { set!.delete(cb); };
    },
    [],
  );

  // Inicializar BroadcastChannel para sync entre tabs
  useEffect(() => {
    broadcastChannel.current = new BroadcastChannel('workflow-cache-sync');
    
    broadcastChannel.current.onmessage = async (event) => {
      if (event.data.type === 'cache-updated' && userId) {
        const { year, month } = event.data;
        // Recarregar do IndexedDB
        const data = await indexedDBCache.get<WorkflowSession[]>(userId, year, month);
        if (data) {
          const key = `${year}-${String(month).padStart(2, '0')}`;
          memoryCache.current.set(key, data);
          notifySubscribers();
        }
      }
    };

    return () => {
      broadcastChannel.current?.close();
    };
  }, [userId]);

  // Monitorar auth state
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        setUserId(session.user.id);
      } else if (event === 'SIGNED_OUT') {
        setUserId(null);
        memoryCache.current.clear();
      }
    });

    // Carregar userId inicial
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setUserId(user.id);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Preload ao definir userId
  useEffect(() => {
    if (userId) {
      preloadMonths();
      const cleanup = setupRealtimeSubscription();
      return cleanup; // CRÍTICO: retornar cleanup para limpar subscription
    }
  }, [userId]);

  const getCacheKey = (year: number, month: number): string => {
    return `${year}-${String(month).padStart(2, '0')}`;
  };

  const getSessionsForMonthSync = useCallback((year: number, month: number): WorkflowSession[] | null => {
    const key = getCacheKey(year, month);
    return memoryCache.current.get(key) || null;
  }, []);

  const getAllCachedSessionsSync = useCallback((): WorkflowSession[] => {
    return Array.from(memoryCache.current.values()).flat();
  }, []);

  const setMonthData = useCallback((year: number, month: number, sessions: WorkflowSession[]) => {
    const key = getCacheKey(year, month);
    const normalized = normalizeWorkflowSessions(sessions);
    memoryCache.current.set(key, normalized);

    // Mantém o workflowStore global sincronizado — o dock de tarefas de produção
    // e outros consumidores fora do mês visível dependem dele para o clique não
    // retornar silenciosamente em "sessão não encontrada".
    try {
      workflowStore.upsertMany(normalized);
    } catch { /* noop */ }

    if (userId) {
      indexedDBCache.set(userId, year, month, normalized);
      broadcastChannel.current?.postMessage({ type: 'cache-updated', year, month });
    }

    // Estado passa a 'ready' assim que temos dados no bucket.
    setMonthState(year, month, { status: 'ready', error: null, loadedAt: Date.now() });

    notifySubscribers();
  }, [userId]);

  const mergeUpdate = useCallback((session: WorkflowSession) => {
    if (!session) return;
    // Normalização parcial: NÃO força defaults em campos ausentes do payload
    // (evita que fetches parciais zerem valor_base_pacote, regras_congeladas, etc.)
    const normalized = normalizeWorkflowSessionPartial(session) as WorkflowSession;

    // Soft-delete (status='historico') deve REMOVER do cache do funil — não dá merge.
    if ((normalized as any).status === 'historico' && (normalized as any).id) {
      console.log('🗑️ [WorkflowCache] mergeUpdate detectou status=historico → removendo', (normalized as any).id);
      removeSessionRef.current?.((normalized as any).id);
      return;
    }
    console.log('🔀 [WorkflowCache] mergeUpdate called for session:', (normalized as any).id, 'updated_at:', (normalized as any).updated_at);

    // 1) Tentar localizar a sessão em algum bucket cacheado (por id UUID ou session_id text)
    let foundKey: string | null = null;
    let foundIdx = -1;
    for (const [k, list] of memoryCache.current.entries()) {
      const i = list.findIndex(
        (s) => s.id === (normalized as any).id || (s as any).session_id === (normalized as any).session_id
      );
      if (i >= 0) {
        foundKey = k;
        foundIdx = i;
        break;
      }
    }

    let year: number;
    let month: number;
    let currentSessions: WorkflowSession[];
    let index: number;

    if (foundKey) {
      // Atualizar no bucket onde a sessão já vive (não depende de data_sessao do payload)
      const [yStr, mStr] = foundKey.split('-');
      year = parseInt(yStr);
      month = parseInt(mStr);
      currentSessions = memoryCache.current.get(foundKey) || [];
      index = foundIdx;
    } else if ((normalized as any).data_sessao) {
      // Sessão nova com data conhecida → inserir no bucket correto
      const ym = getYearMonthFromDateString((normalized as any).data_sessao);
      year = ym.year;
      month = ym.month;
      currentSessions = memoryCache.current.get(getCacheKey(year, month)) || [];
      index = -1;
    } else {
      // Payload parcial sem bucket conhecido e sem data → ignorar para não criar "registro lixo"
      console.warn('⚠️ [WorkflowCache] mergeUpdate ignorado: sessão sem bucket e sem data_sessao', (normalized as any).id);
      return;
    }

    let updatedSessions: WorkflowSession[];
    if (index >= 0) {
      updatedSessions = [...currentSessions];
      // Shallow merge preservando campos populados (normalized é Partial)
      updatedSessions[index] = { ...updatedSessions[index], ...normalized };
    } else {
      updatedSessions = [...currentSessions, normalized];
    }

    setMonthData(year, month, updatedSessions);
  }, [setMonthData]);

  const removeSession = useCallback((sessionId: string) => {
    // Remover de todos os meses em cache
    for (const [key, sessions] of memoryCache.current.entries()) {
      const filtered = sessions.filter(s => s.id !== sessionId);
      if (filtered.length !== sessions.length) {
        const [yearMonth] = key.split('-');
        const year = parseInt(yearMonth);
        const month = parseInt(key.split('-')[1]);
        setMonthData(year, month, filtered);
      }
    }
  }, [setMonthData]);

  // Mantém ref atualizada para uso interno de mergeUpdate (sem ciclo de deps).
  useEffect(() => {
    removeSessionRef.current = removeSession;
  }, [removeSession]);

  // Onda 4b — Bridge EventBus: a Capability `workflow.deleteSession` emite
  // `workflow.card_deleted` ANTES da Promise resolver. Reagimos aqui para
  // remover instantaneamente do cache (e propagar via subscribers), sem
  // depender do realtime do Postgres chegar.
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


  const invalidateMonth = useCallback(async (year: number, month: number) => {
    const key = getCacheKey(year, month);
    // NÃO limpa memoryCache aqui — invalidar cache "vazia" a UI e força
    // skeleton mesmo quando temos dados válidos para revalidar (SWR).
    lastSilentRefreshAt.current.delete(key);

    if (userId) {
      metricsCache.invalidate(userId, year, month);
      // Silent refresh: mantém UI interativa; força re-fetch ignorando TTL.
      // (fire-and-forget para não bloquear callers como update de produto).
      void silentRefreshMonth(year, month, true);
    }
  }, [userId]); // silentRefreshMonth ref é estável dentro do closure do provider




  const fetchAndCacheMonth = async (year: number, month: number) => {
    if (!userId) return;
    const key = getCacheKey(year, month);
    // Cancela fetch anterior deste mesmo mês (troca rápida entre meses).
    monthAbortControllers.current.get(key)?.abort();
    const controller = new AbortController();
    monthAbortControllers.current.set(key, controller);
    try {
      const sessions = await sessionsRepo.listByMonth(userId, year, month, { signal: controller.signal });
      // Se este controller já foi substituído, ignora o resultado (stale).
      if (monthAbortControllers.current.get(key) !== controller) return;
      setMonthData(year, month, sessions);
      lastSilentRefreshAt.current.set(key, Date.now());
    } catch (error: any) {
      if (error?.name === 'AbortError' || error?.code === '20') return;
      console.error('Error fetching month data:', error);
    } finally {
      if (monthAbortControllers.current.get(key) === controller) {
        monthAbortControllers.current.delete(key);
      }
    }
  };

  const preloadMonths = async () => {
    if (!userId) return;

    setIsPreloading(true);
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;

    const monthsToPreload = [
      { year: currentYear, month: currentMonth },
      { year: currentMonth === 1 ? currentYear - 1 : currentYear, month: currentMonth === 1 ? 12 : currentMonth - 1 },
      { year: currentMonth <= 2 ? currentYear - 1 : currentYear, month: currentMonth <= 2 ? currentMonth + 10 : currentMonth - 2 },
      { year: currentMonth === 12 ? currentYear + 1 : currentYear, month: currentMonth === 12 ? 1 : currentMonth + 1 },
    ];

    // Carregar do IndexedDB primeiro (rápido)
    await Promise.all(
      monthsToPreload.map(async ({ year, month }) => {
        const cached = await indexedDBCache.get<WorkflowSession[]>(userId, year, month);
        if (cached) {
          const key = getCacheKey(year, month);
          memoryCache.current.set(key, cached);
        }
      })
    );

    notifySubscribers();

    // FASE 2 (otimizada): TODOS os meses em paralelo. Não bloqueia UI —
    // o cache do IDB já foi hidratado acima; o refresh vive em background.
    Promise.allSettled(
      monthsToPreload.map(({ year, month }) => fetchAndCacheMonth(year, month))
    ).finally(() => {
      // Marca cada mês como "acabou de revalidar" para o TTL evitar reruns.
      const now = Date.now();
      monthsToPreload.forEach(({ year, month }) => {
        lastSilentRefreshAt.current.set(getCacheKey(year, month), now);
      });
    });

    // Prefetch das métricas em paralelo (fire-and-forget).
    monthsToPreload.forEach(({ year, month }) => {
      prefetchMonthMetrics(userId, year, month);
    });

    setIsPreloading(false);
  };


  const setupRealtimeSubscription = () => {
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
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'clientes_sessoes',
        filter: `user_id=eq.${userId}`
      }, async (payload) => {
        console.log('📡 Realtime event (sessoes):', payload.eventType, (payload.new as any)?.id);
        
        // FASE 6: Para INSERT, processar imediatamente (sem debounce)
        // Para UPDATE/DELETE, usar debounce reduzido de 150ms
        if (payload.eventType === 'INSERT') {
          const session = payload.new as WorkflowSession;
          console.log('🆕 [Realtime] INSERT detectado, processando imediatamente...');
          
          // Verificar se já existe no cache (evitar duplicação com merge otimista)
          // CORREÇÃO: Parse direto da string para evitar bug de timezone
          const { year, month } = getYearMonthFromDateString(session.data_sessao);
          const key = `${year}-${String(month).padStart(2, '0')}`;
          const existingSessions = memoryCache.current.get(key) || [];
          
          if (existingSessions.some(s => s.id === session.id)) {
            console.log('⚠️ [Realtime] INSERT: sessão já existe no cache, atualizando...');
            // Atualizar ao invés de adicionar
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
      })
      // FASE 1: Subscription para clientes_transacoes (pagamentos)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'clientes_transacoes',
        filter: `user_id=eq.${userId}`
      }, async (payload) => {
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
      })
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
  };

  const subscribe = useCallback((callback: (sessions: WorkflowSession[]) => void) => {
    subscribers.current.add(callback);
    return () => {
      subscribers.current.delete(callback);
    };
  }, []);

  const notifySubscribers = () => {
    // Coalescing: rajadas de setMonthData (ex.: preloadMonths com 4 meses em paralelo)
    // agora disparam UMA notificação por microtask, em vez de 4 flat() sequenciais.
    if (notifyPending.current) return;
    notifyPending.current = true;
    queueMicrotask(() => {
      notifyPending.current = false;
      const allSessions = Array.from(memoryCache.current.values()).flat();
      subscribers.current.forEach(callback => callback(allSessions));
    });
  };

  const forceRefresh = useCallback(async () => {
    if (!userId) return;
    memoryCache.current.clear();
    await indexedDBCache.clearUser(userId);
    await preloadMonths();
  }, [userId]);

  // SILENT REFRESH: Atualiza dados do Supabase sem limpar cache existente (sem loading)
  // Definido ANTES de ensureMonthLoaded para evitar erro de referência
  const silentRefreshMonth = useCallback(async (year: number, month: number, force = false) => {
    if (!userId) return;
    const key = getCacheKey(year, month);

    // TTL: se acabamos de revalidar este mês, pula (a menos que force=true).
    if (!force) {
      const last = lastSilentRefreshAt.current.get(key) ?? 0;
      if (Date.now() - last < SILENT_REFRESH_TTL_MS) {
        return;
      }
    }
    // Marca ANTES de começar para deduplicar chamadas concorrentes.
    lastSilentRefreshAt.current.set(key, Date.now());

    try {
      // Usa o repo enxuto (mesmo SELECT do fetchAndCacheMonth) — evita trafegar
      // email/telefone/whatsapp em cada linha; contato é buscado sob demanda.
      const sessions = await sessionsRepo.listByMonth(userId, year, month);
      setMonthData(year, month, sessions);
      // Atualiza timestamp após sucesso.
      lastSilentRefreshAt.current.set(key, Date.now());
    } catch (error) {
      console.error('❌ [WorkflowCache] Silent refresh error:', error);
    }
  }, [userId, setMonthData]);

  // Ref para armazenar promises pendentes de carregamento
  const pendingLoads = useRef<Map<string, Promise<void>>>(new Map());

  // FASE 1: Método para garantir que um mês específico está carregado
  // forceRefresh = true: ignora cache e busca do Supabase
  // OTIMIZAÇÃO: Removido busy-wait blocking, usa Promise-based approach
  const ensureMonthLoaded = useCallback(async (year: number, month: number, forceRefresh = false) => {
    const key = getCacheKey(year, month);
    
    // Se já está em cache e NÃO é forceRefresh
    if (!forceRefresh && memoryCache.current.has(key)) {
      const cachedSessions = memoryCache.current.get(key) || [];
      console.log(`⚡ [WorkflowCache] Cache hit for ${key} (${cachedSessions.length} sessions)`);
      
      // Fazer refresh silencioso em background (fire-and-forget)
      silentRefreshMonth(year, month);
      return;
    }
    
    // Se já tem uma Promise pendente para este mês, aguardar ela
    if (pendingLoads.current.has(key)) {
      console.log(`⏳ [WorkflowCache] Already loading ${key}, awaiting existing promise...`);
      await pendingLoads.current.get(key);
      return;
    }
    
    // Criar nova Promise de carregamento
    console.log(`🔄 [WorkflowCache] Fetching from Supabase for ${key}`);
    
    const loadPromise = (async () => {
      try {
        await fetchAndCacheMonth(year, month);
        const sessions = memoryCache.current.get(key) || [];
        console.log(`✅ [WorkflowCache] Successfully loaded ${key} (${sessions.length} sessions from Supabase)`);
      } catch (error) {
        console.error(`❌ [WorkflowCache] Error loading ${key}:`, error);
        throw error;
      } finally {
        pendingLoads.current.delete(key);
      }
    })();
    
    pendingLoads.current.set(key, loadPromise);
    await loadPromise;
  }, [userId, silentRefreshMonth]);

  const isLoadingMonth = useCallback((year: number, month: number): boolean => {
    const key = getCacheKey(year, month);
    return pendingLoads.current.has(key);
  }, []);

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

  // SILENT REFRESH LISTENER (usa silentRefreshMonth já definido anteriormente)
  useEffect(() => {
    const handleSilentRefresh = async (event: CustomEvent) => {
      const { year, month } = event.detail;
      console.log('🔇 [WorkflowCache] Silent refresh event for:', year, month);
      await silentRefreshMonth(year, month);
    };
    
    window.addEventListener('workflow-cache-silent-refresh', handleSilentRefresh as EventListener);
    return () => window.removeEventListener('workflow-cache-silent-refresh', handleSilentRefresh as EventListener);
  }, [silentRefreshMonth]);

  // Listener otimista: atualiza valor_pago localmente ANTES do round-trip ao DB (UI instantânea)
  useEffect(() => {
    const handleOptimistic = (event: CustomEvent) => {
      const { sessionId, delta } = event.detail || {};
      if (!sessionId || typeof delta !== 'number') return;

      // Procurar sessão em todos os meses cacheados (match por id OU session_id)
      for (const [key, sessions] of memoryCache.current.entries()) {
        const idx = sessions.findIndex(s => s.id === sessionId || (s as any).session_id === sessionId);
        if (idx >= 0) {
          const target = sessions[idx];
          const newValorPago = Math.max(0, (Number(target.valor_pago) || 0) + delta);
          const updated = [...sessions];
          updated[idx] = { ...target, valor_pago: newValorPago };
          const [yearStr, monthStr] = key.split('-');
          setMonthData(parseInt(yearStr), parseInt(monthStr), updated);
          console.log('⚡ [WorkflowCache] Otimista aplicado:', sessionId, 'delta:', delta, '→ valor_pago:', newValorPago);
          break;
        }
      }
    };

    window.addEventListener('payment-optimistic' as any, handleOptimistic);
    return () => window.removeEventListener('payment-optimistic' as any, handleOptimistic);
  }, [setMonthData]);

  // Listener autoritativo: busca valor_pago real recalculado pelo trigger SQL
  useEffect(() => {
    if (!userId) return;

    const handlePaymentCreated = async (event: CustomEvent) => {
      const { sessionId } = event.detail || {};
      if (!sessionId) return;
      console.log('💰 [WorkflowCache] payment-created event:', sessionId);

      // Pequena espera inicial para o trigger SQL (reduzida de 350 → 120ms)
      await new Promise(resolve => setTimeout(resolve, 120));

      // F2: SELECT * + clientes — privilegia consistência (1 query por pagamento)
      // F3.2: aceita tanto session_id (TEXT) quanto id (UUID)
      const fetchSession = async () => {
        // Tentativa 1: por session_id (TEXT) — caminho padrão
        const byText = await supabase
          .from('clientes_sessoes')
          .select('*, clientes(nome)')
          .eq('session_id', sessionId)
          .maybeSingle();
        if (byText.data) return byText.data;

        // Tentativa 2: por id UUID — fallback se o evento veio com UUID
        const byUuid = await supabase
          .from('clientes_sessoes')
          .select('*, clientes(nome)')
          .eq('id', sessionId)
          .maybeSingle();
        return byUuid.data;
      };

      let fullSession = await fetchSession();

      // Retry curto se ainda não veio (trigger lento), no máximo 1×
      if (!fullSession) {
        await new Promise(resolve => setTimeout(resolve, 180));
        fullSession = await fetchSession();
      }

      if (fullSession) {
        console.log('✅ [WorkflowCache] Sessão atualizada:', fullSession.id, 'valor_pago:', fullSession.valor_pago);
        mergeUpdate(fullSession as WorkflowSession);
      } else {
        console.warn('⚠️ [WorkflowCache] Sessão não encontrada para sessionId:', sessionId);
      }
    };

    window.addEventListener('payment-created' as any, handlePaymentCreated);
    return () => window.removeEventListener('payment-created' as any, handlePaymentCreated);
  }, [userId, mergeUpdate]);


  const value: WorkflowCacheContextType = {
    getSessionsForMonthSync,
    getAllCachedSessionsSync,
    isPreloading,
    invalidateMonth,
    setMonthData,
    mergeUpdate,
    removeSession,
    subscribe,
    forceRefresh,
    ensureMonthLoaded,
    isLoadingMonth
  };

  return (
    <WorkflowCacheContext.Provider value={value}>
      {children}
    </WorkflowCacheContext.Provider>
  );
};
