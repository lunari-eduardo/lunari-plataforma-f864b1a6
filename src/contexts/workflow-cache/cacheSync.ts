import { useEffect } from 'react';
import { indexedDBCache } from '@/services/IndexedDBCache';
import { WorkflowSession } from '@/features/workflow';
import { BC_KEY, LS_FALLBACK_KEY, getCacheKey } from './types';

export const broadcastCacheUpdated = (
  userId: string | null,
  year: number,
  month: number,
  broadcastChannel: BroadcastChannel | null
) => {
  if (!userId) return;
  const msg = { type: 'cache-updated' as const, year, month };
  try {
    broadcastChannel?.postMessage(msg);
  } catch {
    /* noop */
  }
  // Fallback storage-event: ping efêmero para abas sem BroadcastChannel.
  try {
    window.localStorage.setItem(LS_FALLBACK_KEY, JSON.stringify({ ...msg, t: Date.now() }));
    window.localStorage.removeItem(LS_FALLBACK_KEY);
  } catch {
    /* Safari private mode */
  }
};

export const useCacheBroadcastSync = (
  userId: string | null,
  memoryCache: React.MutableRefObject<Map<string, WorkflowSession[]>>,
  broadcastChannel: React.MutableRefObject<BroadcastChannel | null>,
  notifySubscribers: () => void
) => {
  useEffect(() => {
    const applyMessage = async (data: any) => {
      if (data?.type === 'cache-updated' && userId) {
        const { year, month } = data;
        const stored = await indexedDBCache.get<WorkflowSession[]>(userId, year, month);
        if (stored) {
          const key = getCacheKey(year, month);
          memoryCache.current.set(key, stored);
          notifySubscribers();
        }
      }
    };

    try {
      if (typeof BroadcastChannel !== 'undefined') {
        broadcastChannel.current = new BroadcastChannel(BC_KEY);
        broadcastChannel.current.onmessage = (event) => {
          void applyMessage(event.data);
        };
      }
    } catch {
      broadcastChannel.current = null;
    }

    // Fallback universal: storage event (dispara entre abas do mesmo origin).
    const onStorage = (e: StorageEvent) => {
      if (e.key !== LS_FALLBACK_KEY || !e.newValue) return;
      try {
        void applyMessage(JSON.parse(e.newValue));
      } catch {
        /* noop */
      }
    };
    window.addEventListener('storage', onStorage);

    return () => {
      broadcastChannel.current?.close();
      window.removeEventListener('storage', onStorage);
    };
  }, [userId, memoryCache, broadcastChannel, notifySubscribers]);
};
