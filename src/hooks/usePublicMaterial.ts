import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface PublicMaterialData {
  type: 'active' | 'redirect' | 'not_found';
  data?: any; // The version content
  materialInfo?: any; // The material title, cover, etc
  userProfile?: any; // The photographer info
  redirectSlug?: string;
  shareLinkId?: string;
  customMessage?: string;
}

export function usePublicMaterial(slug: string | undefined) {
  return useQuery({
    queryKey: ['public-material', slug],
    queryFn: async (): Promise<PublicMaterialData> => {
      if (!slug) return { type: 'not_found' };

      const { data, error } = await supabase.functions.invoke('get-public-material', {
        body: { mode: 'public', identifier: slug }
      });

      if (error || !data || data.type === 'not_found') {
        return { type: 'not_found' };
      }

      return data as PublicMaterialData;
    },
    enabled: !!slug,
    staleTime: 1000 * 60 * 5, // 5 min
    retry: false
  });
}
