import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { PublicMaterialData } from './usePublicMaterial';

export function useTrackedMaterial(token: string | undefined) {
  return useQuery({
    queryKey: ['tracked-material', token],
    queryFn: async (): Promise<PublicMaterialData> => {
      if (!token) return { type: 'not_found' };

      const { data, error } = await supabase.functions.invoke('get-public-material', {
        body: { mode: 'tracked', identifier: token }
      });

      if (error || !data || data.type === 'not_found') {
        return { type: 'not_found' };
      }

      return data as PublicMaterialData;
    },
    enabled: !!token,
    staleTime: 1000 * 60 * 5, // 5 min
    retry: false
  });
}
