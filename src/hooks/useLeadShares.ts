import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export function useLeadShares(leadId: string | undefined) {
  const query = useQuery({
    queryKey: ['lead-shares', leadId],
    queryFn: async () => {
      if (!leadId) return [];
      
      const { data, error } = await (supabase as any)
        .from('material_shares')
        .select(`
          id,
          token,
          created_at,
          custom_message,
          material:commercial_materials(title, cover_image_url),
          sessions:material_share_sessions(
            id, 
            created_at, 
            events:material_share_events(event_type, created_at)
          )
        `)
        .eq('lead_id', leadId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!leadId
  });

  return {
    shares: query.data || [],
    isLoading: query.isLoading
  };
}
