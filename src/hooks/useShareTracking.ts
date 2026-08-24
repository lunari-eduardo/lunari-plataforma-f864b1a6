import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { invokeEdgeWorker } from '@/integrations/edge-client';

const API_BASE = import.meta.env.VITE_EDGE_API_URL || 'https://lunari-edge-api.eduardo22diehl.workers.dev';

interface TrackShareEventParams {
  token?: string;
  share_link_slug?: string;
  eventType: 'view_start' | 'view_end' | 'scroll_depth' | 'section_view' | 'cta_view' | 'cta_click' | 'link_click';
  payload?: any;
}

export function useShareTracking({ token, slug }: { token?: string, slug?: string }) {
  const sessionTokenRef = useRef<string>(crypto.randomUUID());
  const maxScrollRef = useRef<number>(0);
  const heartbeatIntervalRef = useRef<any>(null);
  const trackedScrollLevels = useRef(new Set<number>());
  const viewStartFired = useRef(false);

  const trackEvent = useCallback(async (eventType: TrackShareEventParams['eventType'], payload: any = {}) => {
    if (!token && !slug) return;
    
    try {
      await invokeEdgeWorker('api', 'track-share-event', {
        body: {
          token,
          share_link_slug: slug,
          session_token: sessionTokenRef.current,
          event_type: eventType,
          payload,
          occurred_at: new Date().toISOString()
        }
      });
    } catch (err) {
      console.error(`Falha ao registrar evento ${eventType}:`, err);
    }
  }, [token, slug]);

  // 1. view_start e view_end
  useEffect(() => {
    if (!token && !slug) return;
    
    if (!viewStartFired.current) {
      trackEvent('view_start');
      viewStartFired.current = true;
    }

    const handleBeforeUnload = () => {
      const url = `${API_BASE}/functions/v1/track-share-event`;
      const body = JSON.stringify({
        token,
        share_link_slug: slug,
        session_token: sessionTokenRef.current,
        event_type: 'view_end',
        payload: {},
        occurred_at: new Date().toISOString()
      });

      fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body,
        keepalive: true
      }).catch(console.error);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        trackEvent('view_end');
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Heartbeat: Atualiza a duração no servidor a cada 10s caso a aba seja fechada de forma anormal
    heartbeatIntervalRef.current = setInterval(() => {
      if (document.visibilityState === 'visible') {
        trackEvent('heartbeat' as any); // edge function will just update session duration on any event if we want, or we can add it explicitly
      }
    }, 10000);

    return () => {
      if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      trackEvent('view_end');
    };
  }, [token, slug, trackEvent]);

  // 2. scroll_depth
  useEffect(() => {
    const handleScroll = () => {
      const windowHeight = window.innerHeight;
      const documentHeight = document.documentElement.scrollHeight - windowHeight;
      const scrollTop = window.scrollY || document.documentElement.scrollTop;
      
      if (documentHeight <= 0) return;
      
      const scrollPercent = Math.round((scrollTop / documentHeight) * 100);
      
      if (scrollPercent > maxScrollRef.current) {
        maxScrollRef.current = scrollPercent;
      }

      const levels = [25, 50, 75, 100];
      for (const level of levels) {
        if (scrollPercent >= level && !trackedScrollLevels.current.has(level)) {
          trackedScrollLevels.current.add(level);
          trackEvent('scroll_depth', { percent: level });
        }
      }
    };

    // Throttle básico para não sobrecarregar
    let ticking = false;
    const scrollListener = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          handleScroll();
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener('scroll', scrollListener);
    return () => window.removeEventListener('scroll', scrollListener);
  }, [trackEvent]);

  return { trackEvent };
}
