import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// Template padrão de blocos para um novo material
const DEFAULT_TEMPLATE = [
  { type: 'cover', data: { title: '', subtitle: '', image_url: '' } },
  { type: 'about', data: { title: 'Sobre o Estúdio', text: '', photo_url: '' } },
  { type: 'package', data: { name: 'Pacote Principal', price_cents: 0, description: '', items: [], highlight: false } },
  { type: 'cta', data: { whatsapp: '', instagram: '', email: '', text: 'Entre em contato' } },
];

export interface CommercialMaterial {
  id: string;
  user_id: string;
  title: string;
  categoria_id: string | null;
  cover_image_url: string | null;
  status: 'active' | 'archived';
  created_at: string;
  updated_at: string;
  // Joined
  current_version?: {
    id: string;
    version_number: number;
    published_at: string | null;
    created_at: string;
  };
}

export function useMaterials() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['commercial-materials'],
    queryFn: async () => {
      // Buscar materiais com a versão mais recente
      const { data: materials, error } = await (supabase as any)
        .from('commercial_materials')
        .select('*')
        .order('updated_at', { ascending: false });

      if (error) throw error;

      // Para cada material, buscar a versão mais recente
      const materialsWithVersions = await Promise.all(
        (materials || []).map(async (mat: any) => {
          const { data: versions } = await (supabase as any)
            .from('material_versions')
            .select('id, version_number, published_at, created_at')
            .eq('material_id', mat.id)
            .order('version_number', { ascending: false })
            .limit(1);

          return {
            ...mat,
            current_version: versions?.[0] || null,
          } as CommercialMaterial;
        })
      );

      return materialsWithVersions;
    },
  });

  const createMaterial = useMutation({
    mutationFn: async ({ title, categoria_id }: { title: string; categoria_id?: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Não autenticado');

      // 1. Criar o material
      const { data: material, error: matError } = await (supabase as any)
        .from('commercial_materials')
        .insert({
          user_id: user.id,
          title,
          categoria_id: categoria_id || null,
        })
        .select()
        .single();

      if (matError) throw matError;

      // 2. Criar a versão 1 com template padrão
      const { error: verError } = await (supabase as any)
        .from('material_versions')
        .insert({
          material_id: material.id,
          version_number: 1,
          content: DEFAULT_TEMPLATE,
        });

      if (verError) throw verError;

      return material;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['commercial-materials'] });
      toast.success('Material criado com sucesso!');
    },
    onError: (err: any) => {
      toast.error('Erro ao criar material: ' + (err.message || 'Tente novamente'));
    },
  });

  const archiveMaterial = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from('commercial_materials')
        .update({ status: 'archived' })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['commercial-materials'] });
      toast.success('Material arquivado.');
    },
  });

  const deleteMaterial = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from('commercial_materials')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['commercial-materials'] });
      toast.success('Material excluído permanentemente.');
    },
  });

  return {
    materials: query.data || [],
    isLoading: query.isLoading,
    error: query.error,
    createMaterial,
    archiveMaterial,
    deleteMaterial,
  };
}
