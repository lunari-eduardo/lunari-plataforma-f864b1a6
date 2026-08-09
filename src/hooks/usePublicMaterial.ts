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

      // 1. Tentar buscar o link público ativo
      const { data: activeLink, error: activeErr } = await (supabase as any)
        .from('material_share_links')
        .select('id, material_id, user_id, is_active')
        .eq('slug', slug.toLowerCase())
        .single();

      if (activeErr && activeErr.code !== 'PGRST116') {
        throw activeErr;
      }

      let targetMaterialId = activeLink?.material_id;
      let targetUserId = activeLink?.user_id;
      let shareLinkId = activeLink?.id;

      if (!activeLink) {
        // 2. Se não achou, tentar buscar no histórico de slugs
        const { data: historicalSlug, error: histErr } = await (supabase as any)
          .from('material_share_link_slugs')
          .select('share_link_id')
          .eq('slug', slug.toLowerCase())
          .single();

        if (histErr && histErr.code !== 'PGRST116') {
          throw histErr;
        }

        if (historicalSlug) {
          // Achar o slug atual deste share_link_id
          const { data: currentLink } = await (supabase as any)
            .from('material_share_links')
            .select('slug')
            .eq('id', historicalSlug.share_link_id)
            .single();
          
          if (currentLink) {
            return { type: 'redirect', redirectSlug: currentLink.slug };
          }
        }

        return { type: 'not_found' };
      }

      if (!activeLink.is_active) {
        return { type: 'not_found' };
      }

      // 3. Buscar o material e a versão ativa
      const { data: material, error: matErr } = await (supabase as any)
        .from('commercial_materials')
        .select('id, title, cover_image_url, active_version_id')
        .eq('id', targetMaterialId)
        .single();

      if (matErr || !material || !material.active_version_id) {
        return { type: 'not_found' };
      }

      // 4. Buscar conteúdo da versão
      const { data: version, error: verErr } = await (supabase as any)
        .from('material_versions')
        .select('content, version_number')
        .eq('id', material.active_version_id)
        .single();

      if (verErr || !version) {
        return { type: 'not_found' };
      }

      // 5. Buscar dados do fotógrafo (profile)
      const { data: profile } = await (supabase as any)
        .from('profiles')
        .select('nome, whatsapp, avatar_url')
        .eq('id', targetUserId)
        .single();

      return {
        type: 'active',
        data: version.content,
        materialInfo: {
          title: material.title,
          cover_image_url: material.cover_image_url,
          version_number: version.version_number
        },
        userProfile: profile,
        shareLinkId,
      };
    },
    enabled: !!slug,
    staleTime: 1000 * 60 * 5, // 5 min
    retry: false
  });
}
