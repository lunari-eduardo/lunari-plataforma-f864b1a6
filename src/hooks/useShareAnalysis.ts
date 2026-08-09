import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export function useShareAnalysis(shareId: string | undefined) {
  const queryKey = ['share-analysis', shareId];

  return useQuery({
    queryKey,
    queryFn: async () => {
      if (!shareId) return null;

      // 1. Fetch the share details
      const { data: share, error: shareErr } = await (supabase as any)
        .from('material_shares')
        .select(`
          *,
          material:commercial_materials(id, title),
          lead:leads(id, nome, email, whatsapp),
          version:material_versions(version_number)
        `)
        .eq('id', shareId)
        .single();

      if (shareErr) throw shareErr;
      if (!share) return null;

      // 2. Fetch sessions
      const { data: sessions, error: sessErr } = await (supabase as any)
        .from('material_share_sessions')
        .select('*')
        .eq('share_id', shareId)
        .order('started_at', { ascending: false });

      if (sessErr) throw sessErr;

      // 3. Fetch events for these sessions
      let events: any[] = [];
      if (sessions && sessions.length > 0) {
        const sessionIds = sessions.map((s: any) => s.id);
        const { data: evts, error: evtErr } = await (supabase as any)
          .from('material_share_events')
          .select('*')
          .in('session_id', sessionIds)
          .order('occurred_at', { ascending: true });

        if (evtErr) throw evtErr;
        events = evts || [];
      }

      // 4. Calculate aggregate metrics
      const totalSessions = sessions?.length || 0;
      let totalDuration = 0;
      let maxScroll = 0;
      let ctaClicks = 0;
      let ctaViews = 0;
      const uniqueSections = new Set<string>();

      events.forEach(evt => {
        if (evt.event_type === 'scroll_depth') {
          const pct = evt.payload?.percent || 0;
          if (pct > maxScroll) maxScroll = pct;
        }
        if (evt.event_type === 'section_view') {
          if (evt.payload?.block_id) uniqueSections.add(evt.payload.block_id);
        }
        if (evt.event_type === 'cta_view') {
          ctaViews++;
        }
        if (evt.event_type === 'cta_click') {
          ctaClicks++;
        }
      });

      if (sessions) {
        sessions.forEach((s: any) => {
          totalDuration += (s.duration_seconds || 0);
        });
      }

      const avgDuration = totalSessions > 0 ? Math.round(totalDuration / totalSessions) : 0;

      // Combine into a structured result
      return {
        share,
        metrics: {
          totalSessions,
          totalDuration,
          avgDuration,
          maxScroll,
          uniqueSectionsViewed: uniqueSections.size,
          ctaViews,
          ctaClicks,
        },
        sessions: sessions?.map((s: any) => ({
          ...s,
          events: events.filter(e => e.session_id === s.id)
        })) || []
      };
    },
    enabled: !!shareId
  });
}
