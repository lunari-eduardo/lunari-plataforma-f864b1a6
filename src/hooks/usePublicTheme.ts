import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export function usePublicTheme(userId: string | undefined) {
  return useQuery({
    queryKey: ['public-theme', userId],
    queryFn: async () => {
      if (!userId) return null;
      
      const { data, error } = await supabase.functions.invoke('get-public-theme', {
        body: { userId },
      });
      
      if (error) {
        console.warn('Erro ao carregar tema público:', error);
        return null;
      }
      
      return data?.primaryColor as string | null;
    },
    enabled: !!userId,
    staleTime: 1000 * 60 * 5, // 5 minutos
  });
}
