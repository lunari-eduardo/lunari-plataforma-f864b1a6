import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export function useMaterialPublicLink(materialId: string | undefined) {
  const queryClient = useQueryClient();
  const queryKey = ['material-public-link', materialId];

  const query = useQuery({
    queryKey,
    queryFn: async () => {
      if (!materialId) return null;
      
      const { data, error } = await (supabase as any)
        .from('material_share_links')
        .select('*')
        .eq('material_id', materialId)
        .maybeSingle();
        
      if (error && error.code !== 'PGRST116') {
        throw error;
      }
      
      return data;
    },
    enabled: !!materialId
  });

  const generateLink = useMutation({
    mutationFn: async () => {
      if (!materialId) throw new Error('ID do material não fornecido');
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      // Tenta gerar usando a function supabase, mas como não temos RPC pronta para isso,
      // faremos um insert que dependa do default raw_slug (gen_random_uuid).
      // Mas o requisito diz "Gerar automaticamente por padrão" e o trigger before_insert no DB 
      // faz slug = slugify(nome_material) + random se collision.
      // Ops, temos trigger pra isso no DB? 
      // Let's create an entry with empty slug and let the trigger handle it, or we can send the slug.
      
      // I'll fetch the material title to generate a base slug.
      const { data: mat } = await (supabase as any)
        .from('commercial_materials')
        .select('title')
        .eq('id', materialId)
        .single();
        
      const title = mat?.title || 'material';
      const baseSlug = title.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');

      // tenta inserir
      const { data, error } = await (supabase as any)
        .from('material_share_links')
        .insert({
          material_id: materialId,
          user_id: user.id,
          slug: baseSlug + '-' + Math.random().toString(36).substring(2, 6), // prevent collision easily for now
          is_active: true
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast.success('Link público gerado com sucesso!');
    },
    onError: (err: any) => {
      toast.error('Erro ao gerar link: ' + err.message);
    }
  });

  const updateSlug = useMutation({
    mutationFn: async (newSlug: string) => {
      if (!materialId) throw new Error('ID do material não fornecido');
      const formattedSlug = newSlug.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9\-]+/g, '').replace(/(^-|-$)+/g, '');

      const { data, error } = await (supabase as any)
        .from('material_share_links')
        .update({ slug: formattedSlug })
        .eq('material_id', materialId)
        .select()
        .single();

      if (error) {
        if (error.code === '23505') {
          throw new Error('Este link já está em uso por outro material.');
        }
        throw error;
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast.success('Link público personalizado salvo!');
    },
    onError: (err: any) => {
      toast.error(err.message);
    }
  });

  return {
    data: query.data,
    isLoading: query.isLoading,
    generateLink,
    updateSlug
  };
}
