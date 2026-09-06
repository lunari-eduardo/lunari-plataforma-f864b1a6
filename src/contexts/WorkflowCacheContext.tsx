import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { indexedDBCache } from '@/services/IndexedDBCache';
import { WorkflowSession } from '@/features/workflow';
import { normalizeWorkflowSessions } from '@/utils/workflowNormalization';
import { workflowStore } from '@/features/workflow/store/workflowStore';
import '@/modules/workflow/domain/events';

import {
  MonthLoadStatus,
  MonthLoadState,
  WorkflowCacheContextType,
  getCacheKey,
} from './workflow-cache/types';
import { broadcastCacheUpdated, useCacheBroadcastSync } from './workflow-cache/cacheSync';
import { executeMergeUpdate, executeRemoveSession } from './workflow-cache/cacheOperations';
import { useMonthLoader } from './workflow-cache/useMonthLoader';
import { useLegacyRealtime } from './workflow-cache/useLegacyRealtime';
import { useCacheEventListeners } from './workflow-cache/useCacheEventListeners';

export type { MonthLoadStatus, MonthLoadState, WorkflowCacheContextType };

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

  // Cache em memória: Map<"YYYY-MM", WorkflowSession[]>
  const memoryCache = useRef<Map<string, WorkflowSession[]>>(new Map());
  const subscribers = useRef<Set<(sessions: WorkflowSession[]) => void>>(new Set());
  const broadcastChannel = useRef<BroadcastChannel | null>(null);
  const removeSessionRef = useRef<((sessionId: string) => void) | null>(null);
  const notifyPending = useRef(false);

  const notifySubscribers = useCallback(() => {
    if (notifyPending.current) return;
    notifyPending.current = true;
    queueMicrotask(() => {
      notifyPending.current = false;
      const allSessions = Array.from(memoryCache.current.values()).flat();
      subscribers.current.forEach((callback) => callback(allSessions));
    });
  }, []);

  const setMonthDataRef = useRef<(year: number, month: number, sessions: WorkflowSession[]) => void>(() => {});

  const {
    isPreloading,
    setMonthState,
    getMonthStatus,
    subscribeMonthStatus,
    preloadMonths,
    silentRefreshMonth,
    ensureMonthLoaded,
    isLoadingMonth,
    retryMonth,
    invalidateMonth,
    forceRefresh,
  } = useMonthLoader({
    userId,
    memoryCache,
    setMonthData: (year, month, sessions) => setMonthDataRef.current(year, month, sessions),
    notifySubscribers,
  });

  const setMonthData = useCallback(
    (year: number, month: number, sessions: WorkflowSession[]) => {
      const key = getCacheKey(year, month);
      const normalized = normalizeWorkflowSessions(sessions);
      memoryCache.current.set(key, normalized);

      // Mantém o workflowStore global sincronizado
      try {
        workflowStore.upsertMany(normalized);
      } catch {
        /* noop */
      }

      if (userId) {
        indexedDBCache.set(userId, year, month, normalized);
        broadcastCacheUpdated(userId, year, month, broadcastChannel.current);
      }

      setMonthState(year, month, { status: 'ready', error: null, loadedAt: Date.now() });
      notifySubscribers();
    },
    [userId, setMonthState, notifySubscribers],
  );

  setMonthDataRef.current = setMonthData;

  const mergeUpdate = useCallback(
    (session: WorkflowSession) => {
      executeMergeUpdate(memoryCache.current, session, removeSessionRef.current, setMonthData);
    },
    [setMonthData],
  );

  const removeSession = useCallback(
    (sessionId: string) => {
      executeRemoveSession(memoryCache.current, sessionId, setMonthData);
    },
    [setMonthData],
  );

  useEffect(() => {
    removeSessionRef.current = removeSession;
  }, [removeSession]);

  // Sincronização multi-aba via BroadcastChannel e localStorage
  useCacheBroadcastSync(userId, memoryCache, broadcastChannel, notifySubscribers);

  // Monitorar auth state
  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        setUserId(session.user.id);
      } else if (event === 'SIGNED_OUT') {
        setUserId(null);
        memoryCache.current.clear();
      }
    });

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
    }
  }, [userId, preloadMonths]);

  // Subscription realtime legada (quando v2 não está ativa)
  useLegacyRealtime({
    userId,
    memoryCache,
    mergeUpdate,
    removeSession,
  });

  // Listeners de eventos de janela e eventBus
  useCacheEventListeners({
    userId,
    memoryCache,
    mergeUpdate,
    removeSession,
    setMonthData,
    invalidateMonth,
    silentRefreshMonth,
  });

  const getSessionsForMonthSync = useCallback((year: number, month: number): WorkflowSession[] | null => {
    const key = getCacheKey(year, month);
    return memoryCache.current.get(key) || null;
  }, []);

  const getAllCachedSessionsSync = useCallback((): WorkflowSession[] => {
    return Array.from(memoryCache.current.values()).flat();
  }, []);

  const subscribe = useCallback((callback: (sessions: WorkflowSession[]) => void) => {
    subscribers.current.add(callback);
    return () => {
      subscribers.current.delete(callback);
    };
  }, []);

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
    isLoadingMonth,
    getMonthStatus,
    subscribeMonthStatus,
    retryMonth,
  };

  return (
    <WorkflowCacheContext.Provider value={value}>
      {children}
    </WorkflowCacheContext.Provider>
  );
};
