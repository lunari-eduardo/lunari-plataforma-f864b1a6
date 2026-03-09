import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import type { 
  Formulario, 
  FormularioCreateInput, 
  FormularioCampo,
  FormularioResposta 
} from '@/types/formulario';

const QUERY_KEY = 'formularios';
const RESPOSTAS_KEY = 'formulario-respostas';

export function useFormularios() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Buscar todos os formulários do usuário
  const { data: formularios = [], isLoading, error } = useQuery({
    queryKey: [QUERY_KEY, user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('formularios')
        .select(`
          *,
          cliente:clientes(id, nome)
        `)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      return (data || []).map(f => ({
        ...f,
        campos: (f.campos as unknown as FormularioCampo[]) || [],
      })) as Formulario[];
    },
    enabled: !!user,
  });

  // Criar formulário
  const createMutation = useMutation({
    mutationFn: async (input: FormularioCreateInput) => {
      if (!user) throw new Error('Usuário não autenticado');
      
      const { data, error } = await supabase
        .from('formularios')
        .insert({
          user_id: user.id,
          titulo: input.titulo,
          titulo_cliente: input.titulo_cliente || null,
          descricao: input.descricao || null,
          campos: input.campos as unknown as any,
          mensagem_conclusao: input.mensagem_conclusao || 'Obrigado! Seu formulário foi enviado com sucesso.',
          tempo_estimado: input.tempo_estimado || 3,
          template_id: input.template_id || null,
          cliente_id: input.cliente_id || null,
          session_id: input.session_id || null,
          status: 'rascunho',
          status_envio: 'nao_enviado',
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
      toast({ title: 'Formulário criado com sucesso!' });
    },
    onError: (error) => {
      console.error('Erro ao criar formulário:', error);
      toast({ 
        title: 'Erro ao criar formulário', 
        description: error.message,
        variant: 'destructive' 
      });
    },
  });

  // Atualizar formulário
  const updateMutation = useMutation({
    mutationFn: async ({ id, ...input }: Partial<FormularioCreateInput> & { 
      id: string;
      status?: Formulario['status'];
      status_envio?: Formulario['status_envio'];
    }) => {
      if (!user) throw new Error('Usuário não autenticado');
      
      const updateData: any = {};
      if (input.titulo !== undefined) updateData.titulo = input.titulo;
      if (input.titulo_cliente !== undefined) updateData.titulo_cliente = input.titulo_cliente;
      if (input.descricao !== undefined) updateData.descricao = input.descricao;
      if (input.campos !== undefined) updateData.campos = input.campos;
      if (input.mensagem_conclusao !== undefined) updateData.mensagem_conclusao = input.mensagem_conclusao;
      if (input.tempo_estimado !== undefined) updateData.tempo_estimado = input.tempo_estimado;
      if (input.cliente_id !== undefined) updateData.cliente_id = input.cliente_id;
      if (input.session_id !== undefined) updateData.session_id = input.session_id;
      if (input.status !== undefined) updateData.status = input.status;
      if (input.status_envio !== undefined) updateData.status_envio = input.status_envio;
      
      const { data, error } = await supabase
        .from('formularios')
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
      toast({ title: 'Formulário atualizado!' });
    },
    onError: (error) => {
      console.error('Erro ao atualizar formulário:', error);
      toast({ 
        title: 'Erro ao atualizar formulário', 
        description: error.message,
        variant: 'destructive' 
      });
    },
  });

  // Publicar formulário
  const publishMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!user) throw new Error('Usuário não autenticado');
      
      const { data, error } = await supabase
        .from('formularios')
        .update({ 
          status: 'publicado',
          status_envio: 'enviado',
          enviado_em: new Date().toISOString(),
        })
        .eq('id', id)
        .eq('user_id', user.id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
      toast({ title: 'Formulário publicado e pronto para envio!' });
    },
    onError: (error) => {
      console.error('Erro ao publicar formulário:', error);
      toast({ 
        title: 'Erro ao publicar formulário', 
        description: error.message,
        variant: 'destructive' 
      });
    },
  });

  // Deletar formulário
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!user) throw new Error('Usuário não autenticado');
      
      const { error } = await supabase
        .from('formularios')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
      toast({ title: 'Formulário excluído' });
    },
    onError: (error) => {
      console.error('Erro ao excluir formulário:', error);
      toast({ 
        title: 'Erro ao excluir formulário', 
        description: error.message,
        variant: 'destructive' 
      });
    },
  });

  return {
    formularios,
    isLoading,
    error,
    createFormulario: createMutation.mutateAsync,
    updateFormulario: updateMutation.mutateAsync,
    publishFormulario: publishMutation.mutateAsync,
    deleteFormulario: deleteMutation.mutateAsync,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isPublishing: publishMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
}

// Hook para buscar formulário público por token
export function useFormularioPublico(token: string | undefined) {
  return useQuery({
    queryKey: ['formulario-publico', token],
    queryFn: async () => {
      if (!token) throw new Error('Token não fornecido');
      
      const { data, error } = await supabase
        .from('formularios')
        .select('*')
        .eq('public_token', token)
        .eq('status', 'publicado')
        .single();
      
      if (error) throw error;
      
      return {
        ...data,
        campos: (data.campos as unknown as FormularioCampo[]) || [],
      } as Formulario;
    },
    enabled: !!token,
    retry: false,
  });
}

// Hook para submeter resposta de formulário público
export function useSubmitFormularioResposta() {
  return useMutation({
    mutationFn: async ({
      formulario,
      respostas,
      respondente_nome,
      respondente_email,
    }: {
      formulario: Formulario;
      respostas: Record<string, any>;
      respondente_nome?: string;
      respondente_email?: string;
    }) => {
      // Inserir resposta
      const { data: resposta, error: respostaError } = await supabase
        .from('formulario_respostas')
        .insert({
          formulario_id: formulario.id,
          user_id: formulario.user_id,
          respostas,
          respondente_nome: respondente_nome || null,
          respondente_email: respondente_email || null,
        })
        .select()
        .single();
      
      if (respostaError) throw respostaError;
      
      // Atualizar status do formulário para respondido
      const { error: updateError } = await supabase
        .from('formularios')
        .update({ 
          status_envio: 'respondido',
          respondido_em: new Date().toISOString(),
        })
        .eq('id', formulario.id);
      
      if (updateError) {
        console.error('Erro ao atualizar status do formulário:', updateError);
        // Não falhar se o update não funcionar (resposta já foi salva)
      }
      
      return resposta;
    },
  });
}

// Hook para buscar respostas de um formulário
export function useFormularioRespostas(formularioId: string | undefined) {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: [RESPOSTAS_KEY, formularioId],
    queryFn: async () => {
      if (!formularioId) throw new Error('ID do formulário não fornecido');
      
      const { data, error } = await supabase
        .from('formulario_respostas')
        .select('*')
        .eq('formulario_id', formularioId)
        .order('submitted_at', { ascending: false });
      
      if (error) throw error;
      return data as FormularioResposta[];
    },
    enabled: !!formularioId && !!user,
  });
}
