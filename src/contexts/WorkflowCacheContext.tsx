import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { indexedDBCache } from '@/services/IndexedDBCache';
import { WorkflowSession } from '@/hooks/useWorkflowRealtime';

interface WorkflowCacheContextType {
  getSessionsForMonthSync: (year: number, month: number) => WorkflowSession[] | null;
  isPreloading: boolean;
  invalidateMonth: (year: number, month: number) => Promise<void>;
  setMonthData: (year: number, month: number, sessions: WorkflowSession[]) => void;
  mergeUpdate: (session: WorkflowSession) => void;
  removeSession: (sessionId: string) => void;
  subscribe: (callback: (sessions: WorkflowSession[]) => void) => () => void;
  forceRefresh: () => Promise<void>;
  ensureMonthLoaded: (year: number, month: number) => Promise<void>;
  isLoadingMonth: (year: number, month: number) => boolean;
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
  
  // FASE 1: Rastrear meses sendo carregados (evitar requests duplicados)
  const loadingMonths = useRef<Set<string>>(new Set());

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
      setupRealtimeSubscription();
    }
  }, [userId]);

  const getCacheKey = (year: number, month: number): string => {
    return `${year}-${String(month).padStart(2, '0')}`;
  };

  const getSessionsForMonthSync = useCallback((year: number, month: number): WorkflowSession[] | null => {
    const key = getCacheKey(year, month);
    return memoryCache.current.get(key) || null;
  }, []);

  const setMonthData = useCallback((year: number, month: number, sessions: WorkflowSession[]) => {
    const key = getCacheKey(year, month);
    memoryCache.current.set(key, sessions);
    
    if (userId) {
      indexedDBCache.set(userId, year, month, sessions);
      broadcastChannel.current?.postMessage({ type: 'cache-updated', year, month });
    }
    
    notifySubscribers();
  }, [userId]);

  const mergeUpdate = useCallback((session: WorkflowSession) => {
    console.log('🔀 [WorkflowCache] mergeUpdate called for session:', session.id, 'updated_at:', session.updated_at);
    const date = new Date(session.data_sessao);
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const key = getCacheKey(year, month);
    
    const currentSessions = memoryCache.current.get(key) || [];
    const index = currentSessions.findIndex(s => s.id === session.id);
    
    let updatedSessions: WorkflowSession[];
    if (index >= 0) {
      updatedSessions = [...currentSessions];
      updatedSessions[index] = { ...updatedSessions[index], ...session };
    } else {
      updatedSessions = [...currentSessions, session];
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

  const invalidateMonth = useCallback(async (year: number, month: number) => {
    const key = getCacheKey(year, month);
    memoryCache.current.delete(key);
    
    if (userId) {
      await indexedDBCache.remove(userId, year, month);
      await fetchAndCacheMonth(year, month);
    }
  }, [userId]);

  const fetchAndCacheMonth = async (year: number, month: number) => {
    if (!userId) return;

    try {
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0);

      const { data, error } = await supabase
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
        .eq('user_id', userId)
        .gte('data_sessao', startDate.toISOString().split('T')[0])
        .lte('data_sessao', endDate.toISOString().split('T')[0])
        .order('data_sessao', { ascending: false });

      if (error) throw error;

      const sessions = (data || []) as WorkflowSession[];
      setMonthData(year, month, sessions);
    } catch (error) {
      console.error('Error fetching month data:', error);
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

    // FASE 2: SEMPRE atualizar do Supabase para garantir dados frescos
    const chunks = [monthsToPreload.slice(0, 3), monthsToPreload.slice(3)];
    for (const chunk of chunks) {
      await Promise.allSettled(
        chunk.map(({ year, month }) => {
          return fetchAndCacheMonth(year, month);
        })
      );
    }

    setIsPreloading(false);
  };

  const setupRealtimeSubscription = () => {
    if (!userId) return;

    // FASE 3: Debounce para reduzir updates excessivos e flickering
    let realtimeDebounce: NodeJS.Timeout | null = null;

    const channel = supabase
      .channel('workflow-realtime')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'clientes_sessoes',
        filter: `user_id=eq.${userId}`
      }, (payload) => {
        console.log('📡 Realtime event:', payload.eventType, (payload.new as any)?.id);
        
        // Debounce de 300ms para evitar flickering
        if (realtimeDebounce) clearTimeout(realtimeDebounce);
        
        realtimeDebounce = setTimeout(async () => {
          // FASE 3: Hidratar dados do cliente se não estiverem presentes
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            const session = payload.new as WorkflowSession;
            
            // Se não tem dados do cliente, buscar completo
            if (!session.clientes && session.cliente_id) {
              console.log('🔄 [Realtime] Hidratando dados do cliente...');
              const { data: fullSession } = await supabase
                .from('clientes_sessoes')
                .select(`*, clientes(nome, email, telefone, whatsapp)`)
                .eq('id', session.id)
                .single();
              
              if (fullSession) {
                mergeUpdate(fullSession as WorkflowSession);
                return;
              }
            }
            
            mergeUpdate(session);
          }
          if (payload.eventType === 'DELETE' && payload.old) {
            removeSession((payload.old as any).id);
          }
        }, 300);
      })
      .subscribe();

    return () => {
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
    const allSessions = Array.from(memoryCache.current.values()).flat();
    console.log('📢 [WorkflowCache] Notifying subscribers:', allSessions.length, 'sessions');
    subscribers.current.forEach(callback => callback(allSessions));
  };

  const forceRefresh = useCallback(async () => {
    if (!userId) return;
    memoryCache.current.clear();
    await indexedDBCache.clearUser(userId);
    await preloadMonths();
  }, [userId]);

  // FASE 1: Método para garantir que um mês específico está carregado
  const ensureMonthLoaded = useCallback(async (year: number, month: number) => {
    const key = getCacheKey(year, month);
    
    // Se já está em cache, retornar imediatamente
    if (memoryCache.current.has(key)) {
      const cachedSessions = memoryCache.current.get(key) || [];
      console.log(`⚡ [WorkflowCache] Cache hit for ${key} (${cachedSessions.length} sessions)`);
      return;
    }
    
    // Se já está carregando, aguardar
    if (loadingMonths.current.has(key)) {
      console.log(`⏳ [WorkflowCache] Already loading ${key}, waiting...`);
      // Aguardar até que o carregamento termine
      await new Promise<void>((resolve) => {
        const checkInterval = setInterval(() => {
          if (!loadingMonths.current.has(key)) {
            clearInterval(checkInterval);
            resolve();
          }
        }, 100);
      });
      return;
    }
    
    // Marcar como carregando e buscar do Supabase
    loadingMonths.current.add(key);
    console.log(`🔄 [WorkflowCache] Fetching from Supabase for ${key}`);
    
    try {
      await fetchAndCacheMonth(year, month);
      const sessions = memoryCache.current.get(key) || [];
      console.log(`✅ [WorkflowCache] Successfully loaded ${key} (${sessions.length} sessions from Supabase)`);
    } catch (error) {
      console.error(`❌ [WorkflowCache] Error loading ${key}:`, error);
    } finally {
      loadingMonths.current.delete(key);
    }
  }, [userId]);

  const isLoadingMonth = useCallback((year: number, month: number): boolean => {
    const key = getCacheKey(year, month);
    return loadingMonths.current.has(key);
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
          .select(`*, clientes(nome, email, telefone, whatsapp)`)
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

  const value: WorkflowCacheContextType = {
    getSessionsForMonthSync,
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
