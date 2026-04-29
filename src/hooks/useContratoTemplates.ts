import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import type { ContratoTemplate, ContratoTemplateCreateInput } from '@/types/contrato';
import { sanitizeContratoTemplateConteudo } from '@/utils/contratoSeedTemplates';

const QK = 'contrato_templates';

export function useContratoTemplates() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: templates = [], isLoading } = useQuery({
    queryKey: [QK, user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contrato_templates')
        .select('*')
        .order('is_padrao', { ascending: false })
        .order('updated_at', { ascending: false });
      if (error) throw error;
      // Normaliza modelos antigos (remove cláusula de "Local" que puxava endereço,
      // remove duplicações de unidade) sem persistir — protege contratos já
      // gerados e evita escritas em massa.
      return (data || []).map((t: any) => ({
        ...t,
        conteudo: sanitizeContratoTemplateConteudo(t.conteudo || ''),
      })) as ContratoTemplate[];
    },
    enabled: !!user,
  });

  const createMutation = useMutation({
    mutationFn: async (input: ContratoTemplateCreateInput) => {
      if (!user) throw new Error('Usuário não autenticado');
      const { data, error } = await supabase
        .from('contrato_templates')
        .insert({
          user_id: user.id,
          nome: input.nome,
          descricao: input.descricao || null,
          categoria: input.categoria || 'geral',
          conteudo: input.conteudo,
          is_padrao: input.is_padrao || false,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QK] });
    },
    onError: (e: any) => toast({ title: 'Erro ao criar modelo', description: e.message, variant: 'destructive' }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...patch }: Partial<ContratoTemplate> & { id: string }) => {
      const { data, error } = await supabase
        .from('contrato_templates')
        .update(patch)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QK] });
    },
    onError: (e: any) => toast({ title: 'Erro ao atualizar', description: e.message, variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('contrato_templates').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QK] });
    },
    onError: (e: any) => toast({ title: 'Erro ao remover', description: e.message, variant: 'destructive' }),
  });

  return {
    templates,
    isLoading,
    create: createMutation.mutateAsync,
    update: updateMutation.mutateAsync,
    remove: deleteMutation.mutateAsync,
  };
}
