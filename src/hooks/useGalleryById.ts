import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Galeria } from '@/hooks/useSupabaseGalleries';
import { transformGaleria, transformArchivedGaleria } from '@/hooks/gallery/galleryTransformers';

export function useGalleryById(id: string | undefined) {
  return useQuery<Galeria | null>({
    queryKey: ['gallery-by-id', id],
    queryFn: async () => {
      if (!id) return null;

      // 1. Tentar buscar galeria ativa diretamente pelo ID (Primary Key indexada)
      const { data, error } = await supabase
        .from('galerias')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (error) {
        console.error('[useGalleryById] Erro ao buscar galeria ativa por ID:', error);
        throw error;
      }

      if (data) {
        return transformGaleria(data);
      }

      // 2. Fallback: buscar em galerias_arquivadas
      const { data: archData, error: archError } = await (supabase as any)
        .from('galerias_arquivadas')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (archError && archError.code !== '42P01') {
        console.error('[useGalleryById] Erro ao buscar galeria arquivada:', archError);
      }

      if (archData) {
        return transformArchivedGaleria(archData);
      }

      return null;
    },
    enabled: !!id,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
}
