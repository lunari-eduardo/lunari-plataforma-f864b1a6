import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { PublicMaterialData } from './usePublicMaterial';

export function useTrackedMaterial(token: string | undefined) {
  return useQuery({
    queryKey: ['tracked-material', token],
    queryFn: async (): Promise<PublicMaterialData> => {
      if (!token) return { type: 'not_found' };

      // 1. Buscar o share rastreável
      const { data: share, error: shareErr } = await (supabase as any)
        .from('material_shares')
        .select('id, material_id, version_id, user_id, custom_message')
        .eq('token', token)
        .single();

      if (shareErr || !share) {
        return { type: 'not_found' };
      }

      // 2. Buscar informações do material
      const { data: material } = await (supabase as any)
        .from('commercial_materials')
        .select('title, cover_image_url')
        .eq('id', share.material_id)
        .single();

      // 3. Buscar conteúdo exato da versão "travada"
      const { data: version } = await (supabase as any)
        .from('material_versions')
        .select('content, version_number')
        .eq('id', share.version_id)
        .single();

      if (!version) {
        return { type: 'not_found' };
      }

      // 4. Buscar perfil do fotógrafo
      const { data: profile } = await (supabase as any)
        .from('profiles')
        .select('nome, whatsapp, avatar_url')
        .eq('id', share.user_id)
        .single();

      // Opcional: registrar evento view_start na Edge Function (será implementado na integração real)
      
      return {
        type: 'active',
        data: version.content,
        materialInfo: {
          title: material?.title || 'Proposta',
          cover_image_url: material?.cover_image_url,
          version_number: version.version_number
        },
        userProfile: profile,
        shareLinkId: share.id, // Usamos a propriedade shareLinkId para armazenar o ID do share para facilitar eventos depois
        customMessage: share.custom_message
      };
    },
    enabled: !!token,
    staleTime: 1000 * 60 * 5, // 5 min
    retry: false
  });
}
