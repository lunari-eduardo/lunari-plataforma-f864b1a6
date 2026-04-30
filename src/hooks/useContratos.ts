import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import type { Contrato, ContratoCreateInput, ContratoStatus } from '@/types/contrato';

const QK = 'contratos';

interface UseContratosOpts {
  clienteId?: string;
  sessionId?: string;
}

export function useContratos(opts: UseContratosOpts = {}) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { clienteId, sessionId } = opts;

  const { data: contratos = [], isLoading } = useQuery({
    queryKey: [QK, user?.id, clienteId, sessionId],
    queryFn: async () => {
      let q = supabase
        .from('contratos')
        .select(`*, cliente:clientes(id, nome, email), template:contrato_templates(id, nome)`)
        .order('created_at', { ascending: false });
      if (clienteId) q = q.eq('cliente_id', clienteId);
      if (sessionId) q = q.eq('session_id', sessionId);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as unknown as Contrato[];
    },
    enabled: !!user,
  });

  const createMutation = useMutation({
    mutationFn: async (input: ContratoCreateInput) => {
      if (!user) throw new Error('Usuário não autenticado');
      const { data, error } = await supabase
        .from('contratos')
        .insert({
          user_id: user.id,
          cliente_id: input.cliente_id,
          session_id: input.session_id || null,
          template_id: input.template_id || null,
          titulo: input.titulo,
          conteudo: input.conteudo,
          variaveis_snapshot: input.variaveis_snapshot || {},
          observacoes: input.observacoes || null,
          status: 'rascunho',
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QK] });
    },
    onError: (e: any) => toast({ title: 'Erro ao criar contrato', description: e.message, variant: 'destructive' }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...patch }: Partial<Contrato> & { id: string }) => {
      const { data, error } = await supabase.from('contratos').update(patch as any).eq('id', id).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [QK] }),
    onError: (e: any) => toast({ title: 'Erro ao atualizar', description: e.message, variant: 'destructive' }),
  });

  const setStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: ContratoStatus }) => {
      const patch: any = { status };
      if (status === 'enviado') patch.enviado_em = new Date().toISOString();
      if (status === 'assinado') patch.assinado_em = new Date().toISOString();
      const { data, error } = await supabase.from('contratos').update(patch).eq('id', id).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QK] });
    },
    onError: (e: any) => toast({ title: 'Erro', description: e.message, variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('contratos').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QK] });
    },
    onError: (e: any) => toast({ title: 'Erro ao remover', description: e.message, variant: 'destructive' }),
  });

  /**
   * Faz upload do PDF assinado para o storage privado.
   */
  const uploadAssinadoMutation = useMutation({
    mutationFn: async ({ contratoId, file }: { contratoId: string; file: File }) => {
      if (!user) throw new Error('Usuário não autenticado');
      const ext = file.name.split('.').pop() || 'pdf';
      const path = `${user.id}/${contratoId}/assinado-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from('contratos-assinados')
        .upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) throw upErr;

      const { data, error } = await supabase
        .from('contratos')
        .update({
          arquivo_assinado_path: path,
          arquivo_assinado_nome: file.name,
          arquivo_assinado_tamanho: file.size,
          status: 'assinado',
          assinado_em: new Date().toISOString(),
        })
        .eq('id', contratoId)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QK] });
    },
    onError: (e: any) => toast({ title: 'Erro no upload', description: e.message, variant: 'destructive' }),
  });

  const getSignedUrl = async (path: string): Promise<string | null> => {
    const { data, error } = await supabase.storage
      .from('contratos-assinados')
      .createSignedUrl(path, 60 * 5);
    if (error) return null;
    return data?.signedUrl || null;
  };

  /**
   * Envia o contrato para assinatura via Autentique.
   * Recebe o PDF já gerado no client (Blob) e converte para base64.
   */
  const enviarParaAssinaturaMutation = useMutation({
    mutationFn: async ({
      contratoId,
      pdfBlob,
      includeFotografo,
    }: {
      contratoId: string;
      pdfBlob: Blob;
      includeFotografo?: boolean;
    }) => {
      const pdfBase64 = await blobToBase64(pdfBlob);
      const { data, error } = await supabase.functions.invoke('autentique-send-contrato', {
        body: {
          contrato_id: contratoId,
          pdf_base64: pdfBase64,
          include_fotografo: !!includeFotografo,
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error.message);
      return data as { success: true; document_id: string; signers: any[] };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QK] });
    },
    onError: (e: any) =>
      toast({
        title: 'Não foi possível enviar para assinatura',
        description: e?.message || 'Tente novamente em alguns instantes.',
        variant: 'destructive',
      }),
  });

  return {
    contratos,
    isLoading,
    create: createMutation.mutateAsync,
    update: updateMutation.mutateAsync,
    setStatus: setStatusMutation.mutateAsync,
    remove: deleteMutation.mutateAsync,
    uploadAssinado: uploadAssinadoMutation.mutateAsync,
    enviarParaAssinatura: enviarParaAssinaturaMutation.mutateAsync,
    isEnviandoParaAssinatura: enviarParaAssinaturaMutation.isPending,
    getSignedUrl,
  };
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => {
      const result = reader.result as string;
      // result vem como "data:application/pdf;base64,XXXX" — devolvemos só o XXXX
      const idx = result.indexOf(',');
      resolve(idx >= 0 ? result.slice(idx + 1) : result);
    };
    reader.readAsDataURL(blob);
  });
}
