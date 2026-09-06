import { useState, useCallback, useRef } from 'react';
import { WorkflowSession } from '@/features/workflow';
import { indexedDBCache } from '@/services/IndexedDBCache';
import { sessionsRepo } from '@/features/workflow/data';
import { prefetchMonthMetrics } from '@/features/workflow/data/metricsRepo';
import { metricsCache } from '@/features/workflow/data/metricsCache';
import {
  MonthLoadState,
  DEFAULT_STATE,
  SILENT_REFRESH_TTL_MS,
  getCacheKey,
} from './types';

interface UseMonthLoaderProps {
  userId: string | null;
  memoryCache: React.MutableRefObject<Map<string, WorkflowSession[]>>;
  setMonthData: (year: number, month: number, sessions: WorkflowSession[]) => void;
  notifySubscribers: () => void;
}

export const useMonthLoader = ({
  userId,
  memoryCache,
  setMonthData,
  notifySubscribers,
}: UseMonthLoaderProps) => {
  const [isPreloading, setIsPreloading] = useState(false);

  const monthStateMap = useRef<Map<string, MonthLoadState>>(new Map());
  const monthStateSubs = useRef<Map<string, Set<(s: MonthLoadState) => void>>>(new Map());
  const silentInFlight = useRef<Map<string, Promise<void>>>(new Map());
  const lastSilentRefreshAt = useRef<Map<string, number>>(new Map());
  const monthAbortControllers = useRef<Map<string, AbortController>>(new Map());
  const pendingLoads = useRef<Map<string, Promise<void>>>(new Map());

  const setMonthState = useCallback((year: number, month: number, patch: Partial<MonthLoadState>) => {
    const key = getCacheKey(year, month);
    const prev = monthStateMap.current.get(key) ?? DEFAULT_STATE;
    const next: MonthLoadState = { ...prev, ...patch };
    if (
      next.status === prev.status &&
      next.error === prev.error &&
      next.loadedAt === prev.loadedAt
    ) {
      return;
    }
    monthStateMap.current.set(key, next);
    const subs = monthStateSubs.current.get(key);
    if (subs) {
      subs.forEach((cb) => {
        try {
          cb(next);
        } catch {
          /* noop */
        }
      });
    }
  }, []);

  const getMonthStatus = useCallback((year: number, month: number): MonthLoadState => {
    return monthStateMap.current.get(getCacheKey(year, month)) ?? DEFAULT_STATE;
  }, []);

  const subscribeMonthStatus = useCallback(
    (year: number, month: number, cb: (s: MonthLoadState) => void) => {
      const key = getCacheKey(year, month);
      let set = monthStateSubs.current.get(key);
      if (!set) {
        set = new Set();
        monthStateSubs.current.set(key, set);
      }
      set.add(cb);
      return () => {
        set!.delete(cb);
      };
    },
    [],
  );

  const fetchAndCacheMonth = useCallback(async (year: number, month: number) => {
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
      // Só marca erro se ainda somos o controller vigente (não fomos abortados).
      if (monthAbortControllers.current.get(key) === controller) {
        const hasCache = memoryCache.current.has(key);
        setMonthState(year, month, {
          status: hasCache ? 'ready' : 'error',
          error: error?.message ?? String(error),
        });
      }
    } finally {
      if (monthAbortControllers.current.get(key) === controller) {
        monthAbortControllers.current.delete(key);
      }
    }
  }, [userId, memoryCache, setMonthData, setMonthState]);

  const silentRefreshMonth = useCallback(async (year: number, month: number, force = false) => {
    if (!userId) return;
    const key = getCacheKey(year, month);

    // Dedup real: se há refresh in-flight para este mês, reaproveita.
    const existing = silentInFlight.current.get(key);
    if (existing) return existing;

    // TTL: se acabamos de revalidar este mês, pula (a menos que force=true).
    if (!force) {
      const last = lastSilentRefreshAt.current.get(key) ?? 0;
      if (Date.now() - last < SILENT_REFRESH_TTL_MS) return;
    }
    lastSilentRefreshAt.current.set(key, Date.now());

    // Sinaliza 'stale' apenas se já temos dados; se não temos, quem chamou
    // ensureMonthLoaded já marcou 'loading'.
    if (memoryCache.current.has(key)) {
      setMonthState(year, month, { status: 'stale', error: null });
    }

    const promise = (async () => {
      try {
        const sessions = await sessionsRepo.listByMonth(userId, year, month);
        setMonthData(year, month, sessions); // → status: ready
        lastSilentRefreshAt.current.set(key, Date.now());
      } catch (error: any) {
        console.error('❌ [WorkflowCache] Silent refresh error:', error);
        const hasCache = memoryCache.current.has(key);
        setMonthState(year, month, {
          status: hasCache ? 'ready' : 'error',
          error: error?.message ?? String(error),
        });
      } finally {
        silentInFlight.current.delete(key);
      }
    })();
    silentInFlight.current.set(key, promise);
    return promise;
  }, [userId, memoryCache, setMonthData, setMonthState]);

  const preloadMonths = useCallback(async () => {
    if (!userId) return;
    setIsPreloading(true);
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const key = getCacheKey(year, month);

    // Reidratação síncrona do IDB (rápido).
    const cached = await indexedDBCache.get<WorkflowSession[]>(userId, year, month);
    if (cached) {
      memoryCache.current.set(key, cached);
      setMonthState(year, month, { status: 'ready', error: null, loadedAt: Date.now() });
      notifySubscribers();
    }

    // Fetch fresco em background — silent refresh, não bloqueia UI.
    fetchAndCacheMonth(year, month).finally(() => {
      lastSilentRefreshAt.current.set(key, Date.now());
    });

    // Métricas do mês corrente (única prefetch — adjacentes vêm por hover).
    prefetchMonthMetrics(userId, year, month);

    setIsPreloading(false);
  }, [userId, memoryCache, setMonthState, notifySubscribers, fetchAndCacheMonth]);

  const ensureMonthLoaded = useCallback(async (year: number, month: number, forceRefresh = false) => {
    const key = getCacheKey(year, month);

    // Cache hit → revalida silenciosamente e retorna.
    if (!forceRefresh && memoryCache.current.has(key)) {
      // Garante status ready caso este mês esteja em 'idle' (nunca marcado).
      const cur = monthStateMap.current.get(key);
      if (!cur || cur.status === 'idle') {
        setMonthState(year, month, { status: 'ready', error: null, loadedAt: Date.now() });
      }
      silentRefreshMonth(year, month);
      return;
    }

    // Já em andamento — reaproveita.
    if (pendingLoads.current.has(key)) {
      await pendingLoads.current.get(key);
      return;
    }

    // Cross-month cancel: se estamos pedindo cold-load de X, cancela cold-load
    // pendente de Y ≠ X.
    monthAbortControllers.current.forEach((ctrl, k) => {
      if (k !== key) {
        try {
          ctrl.abort();
        } catch {
          /* noop */
        }
        monthAbortControllers.current.delete(k);
        pendingLoads.current.delete(k);
      }
    });

    // Cold load: marca loading antes do fetch.
    setMonthState(year, month, { status: 'loading', error: null });

    const loadPromise = (async () => {
      try {
        await fetchAndCacheMonth(year, month);
      } catch (error) {
        console.error(`❌ [WorkflowCache] Error loading ${key}:`, error);
        throw error;
      } finally {
        pendingLoads.current.delete(key);
      }
    })();

    pendingLoads.current.set(key, loadPromise);
    await loadPromise;
  }, [memoryCache, setMonthState, silentRefreshMonth, fetchAndCacheMonth]);

  const isLoadingMonth = useCallback((year: number, month: number): boolean => {
    const key = getCacheKey(year, month);
    return pendingLoads.current.has(key);
  }, []);

  const retryMonth = useCallback(async (year: number, month: number) => {
    const key = getCacheKey(year, month);
    silentInFlight.current.delete(key);
    lastSilentRefreshAt.current.delete(key);
    await ensureMonthLoaded(year, month, true);
  }, [ensureMonthLoaded]);

  const invalidateMonth = useCallback(async (year: number, month: number) => {
    const key = getCacheKey(year, month);
    lastSilentRefreshAt.current.delete(key);

    if (userId) {
      metricsCache.invalidate(userId, year, month);
      void silentRefreshMonth(year, month, true);
    }
  }, [userId, silentRefreshMonth]);

  const forceRefresh = useCallback(async () => {
    if (!userId) return;
    memoryCache.current.clear();
    await indexedDBCache.clearUser(userId);
    await preloadMonths();
  }, [userId, memoryCache, preloadMonths]);

  return {
    isPreloading,
    setMonthState,
    getMonthStatus,
    subscribeMonthStatus,
    preloadMonths,
    fetchAndCacheMonth,
    silentRefreshMonth,
    ensureMonthLoaded,
    isLoadingMonth,
    retryMonth,
    invalidateMonth,
    forceRefresh,
  };
};
