import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import type { FormularioTemplate, FormularioTemplateCreateInput, FormularioCampo } from '@/types/formulario';

const QUERY_KEY = 'formulario-templates';

export function useFormularioTemplates() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Buscar todos os templates (sistema + customizados do usuário)
  const { data: templates = [], isLoading, error } = useQuery({
    queryKey: [QUERY_KEY, user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('formulario_templates')
        .select('*')
        .order('is_system', { ascending: false })
        .order('nome');
      
      if (error) throw error;
      
      // Parse campos JSONB para array tipado
      return (data || []).map(template => ({
        ...template,
        campos: (template.campos as unknown as FormularioCampo[]) || [],
      })) as FormularioTemplate[];
    },
    enabled: !!user,
  });

  // Separar templates do sistema e customizados
  const systemTemplates = templates.filter(t => t.is_system);
  const customTemplates = templates.filter(t => !t.is_system);

  // Criar template customizado
  const createMutation = useMutation({
    mutationFn: async (input: FormularioTemplateCreateInput) => {
      if (!user) throw new Error('Usuário não autenticado');
      
      const { data, error } = await supabase
        .from('formulario_templates')
        .insert({
          user_id: user.id,
          nome: input.nome,
          categoria: input.categoria,
          descricao: input.descricao || null,
          campos: input.campos as unknown as any,
          tempo_estimado: input.tempo_estimado || 3,
          is_system: false,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
      toast({ title: 'Template criado com sucesso!' });
    },
    onError: (error) => {
      console.error('Erro ao criar template:', error);
      toast({ 
        title: 'Erro ao criar template', 
        description: error.message,
        variant: 'destructive' 
      });
    },
  });

  // Atualizar template customizado
  const updateMutation = useMutation({
    mutationFn: async ({ id, ...input }: Partial<FormularioTemplateCreateInput> & { id: string }) => {
      if (!user) throw new Error('Usuário não autenticado');
      
      const updateData: any = {};
      if (input.nome !== undefined) updateData.nome = input.nome;
      if (input.categoria !== undefined) updateData.categoria = input.categoria;
      if (input.descricao !== undefined) updateData.descricao = input.descricao;
      if (input.campos !== undefined) updateData.campos = input.campos;
      if (input.tempo_estimado !== undefined) updateData.tempo_estimado = input.tempo_estimado;
      
      const { data, error } = await supabase
        .from('formulario_templates')
        .update(updateData)
        .eq('id', id)
        .eq('user_id', user.id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
      toast({ title: 'Template atualizado!' });
    },
    onError: (error) => {
      console.error('Erro ao atualizar template:', error);
      toast({ 
        title: 'Erro ao atualizar template', 
        description: error.message,
        variant: 'destructive' 
      });
    },
  });

  // Deletar template customizado
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!user) throw new Error('Usuário não autenticado');
      
      const { error } = await supabase
        .from('formulario_templates')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
      toast({ title: 'Template excluído' });
    },
    onError: (error) => {
      console.error('Erro ao excluir template:', error);
      toast({ 
        title: 'Erro ao excluir template', 
        description: error.message,
        variant: 'destructive' 
      });
    },
  });

  // Duplicar template (cria cópia customizada)
  const duplicateMutation = useMutation({
    mutationFn: async (template: FormularioTemplate) => {
      if (!user) throw new Error('Usuário não autenticado');
      
      const { data, error } = await supabase
        .from('formulario_templates')
        .insert({
          user_id: user.id,
          nome: `${template.nome} (cópia)`,
          categoria: template.categoria,
          descricao: template.descricao,
          campos: template.campos as unknown as any,
          tempo_estimado: template.tempo_estimado,
          is_system: false,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
      toast({ title: 'Template duplicado com sucesso!' });
    },
    onError: (error) => {
      console.error('Erro ao duplicar template:', error);
      toast({ 
        title: 'Erro ao duplicar template', 
        description: error.message,
        variant: 'destructive' 
      });
    },
  });

  return {
    templates,
    systemTemplates,
    customTemplates,
    isLoading,
    error,
    createTemplate: createMutation.mutateAsync,
    updateTemplate: updateMutation.mutateAsync,
    deleteTemplate: deleteMutation.mutateAsync,
    duplicateTemplate: duplicateMutation.mutateAsync,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
}
