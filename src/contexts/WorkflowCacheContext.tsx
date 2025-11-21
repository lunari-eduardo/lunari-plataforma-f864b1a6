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

    // Depois, atualizar do Supabase em paralelo (máx 3 por vez)
    const chunks = [monthsToPreload.slice(0, 3), monthsToPreload.slice(3)];
    for (const chunk of chunks) {
      await Promise.allSettled(
        chunk.map(({ year, month }) => {
          const key = getCacheKey(year, month);
          if (!memoryCache.current.has(key)) {
            return fetchAndCacheMonth(year, month);
          }
          return Promise.resolve();
        })
      );
    }

    setIsPreloading(false);
  };

  const setupRealtimeSubscription = () => {
    if (!userId) return;

    const channel = supabase
      .channel('workflow-realtime')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'clientes_sessoes',
        filter: `user_id=eq.${userId}`
      }, (payload) => {
        if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
          mergeUpdate(payload.new as WorkflowSession);
        }
        if (payload.eventType === 'DELETE') {
          removeSession(payload.old.id);
        }
      })
      .subscribe();

    return () => {
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
    subscribers.current.forEach(callback => callback(allSessions));
  };

  const forceRefresh = useCallback(async () => {
    if (!userId) return;
    memoryCache.current.clear();
    await indexedDBCache.clearUser(userId);
    await preloadMonths();
  }, [userId]);

  const value: WorkflowCacheContextType = {
    getSessionsForMonthSync,
    isPreloading,
    invalidateMonth,
    setMonthData,
    mergeUpdate,
    removeSession,
    subscribe,
    forceRefresh
  };

  return (
    <WorkflowCacheContext.Provider value={value}>
      {children}
    </WorkflowCacheContext.Provider>
  );
};
