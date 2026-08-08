import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export function useMaterialShares(materialId: string | undefined) {
  const queryClient = useQueryClient();
  const queryKey = ['material-shares', materialId];

  const query = useQuery({
    queryKey,
    queryFn: async () => {
      if (!materialId) return [];
      const { data, error } = await (supabase as any)
        .from('material_shares')
        .select(`
          *,
          lead:leads(nome, email, whatsapp)
        `)
        .eq('material_id', materialId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!materialId
  });

  const createShare = useMutation({
    mutationFn: async ({ lead_id, custom_message }: { lead_id?: string; custom_message?: string }) => {
      if (!materialId) throw new Error('Material não informado');

      // Primeiro, pegar o active_version_id do material
      const { data: material, error: matErr } = await (supabase as any)
        .from('commercial_materials')
        .select('active_version_id, user_id')
        .eq('id', materialId)
        .single();

      if (matErr || !material) throw new Error('Material não encontrado');
      if (!material.active_version_id) throw new Error('O material precisa ser publicado antes de enviar.');

      // Gerar um token opaco simples
      const token = Math.random().toString(36).substring(2, 10) + Math.random().toString(36).substring(2, 10);

      const { data, error } = await (supabase as any)
        .from('material_shares')
        .insert({
          material_id: materialId,
          version_id: material.active_version_id,
          user_id: material.user_id,
          lead_id: lead_id || null,
          token,
          custom_message: custom_message || null
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast.success('Compartilhamento rastreável criado!');
    },
    onError: (err: any) => {
      toast.error('Erro ao enviar: ' + err.message);
    }
  });

  return {
    shares: query.data || [],
    isLoading: query.isLoading,
    createShare
  };
}
