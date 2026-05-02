import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { resolveR2SignedUrl, deleteR2Object } from '@/hooks/useR2SignedUrl';

export interface UploadedFile {
  id: string;
  nome: string;
  tipo: string;
  tamanho: number;
  url: string;          // CDN público OU URL pré-assinada (R2)
  storagePath?: string; // chave no R2 (privado)
  uploadDate: string;
  clienteId?: string;
  orcamentoId?: string;
  taskId?: string;
  description?: string;
}

interface UploadMeta {
  clienteId?: string;
  orcamentoId?: string;
  taskId?: string;
  description?: string;
}

const ALLOWED_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/jpg',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

export function useFileUpload() {
  const [uploading, setUploading] = useState(false);
  const [files, setFiles] = useState<UploadedFile[]>([]);

  const loadFiles = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setFiles([]);
        return;
      }

      // Carrega documentos de clientes + anexos de tarefas em paralelo
      const [docsRes, attRes] = await Promise.all([
        supabase
          .from('clientes_documentos')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('task_attachments')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false }),
      ]);

      const all: UploadedFile[] = [];

      for (const d of docsRes.data || []) {
        const path = (d as any).r2_storage_path || (d as any).storage_path;
        const url = path ? (await resolveR2SignedUrl(path)) || '' : '';
        all.push({
          id: d.id,
          nome: d.nome,
          tipo: d.tipo,
          tamanho: d.tamanho,
          url,
          storagePath: path,
          uploadDate: d.created_at,
          clienteId: d.cliente_id,
          description: d.descricao || undefined,
        });
      }

      for (const a of attRes.data || []) {
        const url = a.storage_path ? (await resolveR2SignedUrl(a.storage_path)) || '' : '';
        all.push({
          id: a.id,
          nome: a.nome,
          tipo: a.tipo,
          tamanho: a.tamanho,
          url,
          storagePath: a.storage_path,
          uploadDate: a.created_at,
          taskId: a.task_id,
          description: a.descricao || undefined,
        });
      }

      setFiles(all);
    } catch (err) {
      console.error('❌ Erro ao carregar arquivos:', err);
      setFiles([]);
    }
  }, []);

  useEffect(() => {
    loadFiles();
  }, [loadFiles]);

  const uploadFile = async (
    file: File,
    metadata: UploadMeta = {}
  ): Promise<UploadedFile | null> => {
    if (!file) return null;

    if (!ALLOWED_TYPES.includes(file.type)) {
      toast.error('Tipo de arquivo não permitido. Use PDF, JPG, PNG ou DOC');
      return null;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Arquivo muito grande. Tamanho máximo: 10MB');
      return null;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error('Sessão expirada');
      return null;
    }

    setUploading(true);
    try {
      // Define contexto/entidade para o R2
      const isTask = !!metadata.taskId;
      const isClient = !!metadata.clienteId;
      const context = isClient ? 'client-document' : 'task';
      const entityId = metadata.clienteId || metadata.taskId;

      const formData = new FormData();
      formData.append('file', file);
      formData.append('context', context);
      if (entityId) formData.append('entityId', entityId);

      const { data: upRes, error: upErr } = await supabase.functions.invoke('r2-upload', { body: formData });
      if (upErr) throw upErr;
      if (!upRes?.success) throw new Error(upRes?.error || 'Falha no upload');
      const storagePath = upRes.storagePath as string;

      // Persiste metadados conforme contexto
      let id = `tmp_${Date.now()}`;
      let createdAt = new Date().toISOString();

      if (isClient) {
        const { data, error } = await supabase
          .from('clientes_documentos')
          .insert({
            cliente_id: metadata.clienteId!,
            user_id: user.id,
            nome: file.name,
            tipo: file.type,
            tamanho: file.size,
            storage_path: storagePath,
            r2_storage_path: storagePath,
            descricao: metadata.description,
          })
          .select()
          .single();
        if (error) throw error;
        id = data.id;
        createdAt = data.created_at;
      } else if (isTask) {
        const { data, error } = await supabase
          .from('task_attachments')
          .insert({
            task_id: metadata.taskId!,
            user_id: user.id,
            nome: file.name,
            tipo: file.type,
            tamanho: file.size,
            storage_path: storagePath,
            descricao: metadata.description,
          })
          .select()
          .single();
        if (error) throw error;
        id = data.id;
        createdAt = data.created_at;
      }
      // Para orçamento (sem tabela dedicada), só devolvemos o objeto (não persiste DB).

      const url = await resolveR2SignedUrl(storagePath);
      const uploaded: UploadedFile = {
        id,
        nome: file.name,
        tipo: file.type,
        tamanho: file.size,
        url: url || '',
        storagePath,
        uploadDate: createdAt,
        ...metadata,
      };
      setFiles((prev) => [uploaded, ...prev]);
      return uploaded;
    } catch (error) {
      console.error('❌ Erro no upload:', error);
      toast.error('Erro ao fazer upload do arquivo');
      return null;
    } finally {
      setUploading(false);
    }
  };

  const deleteFile = async (fileId: string) => {
    const file = files.find((f) => f.id === fileId);
    if (!file) return;

    try {
      // Apaga do R2
      if (file.storagePath) {
        await deleteR2Object(file.storagePath);
      }
      // Apaga metadados
      if (file.clienteId) {
        await supabase.from('clientes_documentos').delete().eq('id', fileId);
      } else if (file.taskId) {
        await supabase.from('task_attachments').delete().eq('id', fileId);
      }
      setFiles((prev) => prev.filter((f) => f.id !== fileId));
    } catch (e) {
      console.error('❌ Erro ao remover arquivo:', e);
      toast.error('Erro ao remover arquivo');
    }
  };

  const getFilesByClient = (clienteId: string) => files.filter((f) => f.clienteId === clienteId);
  const getFilesByOrcamento = (orcamentoId: string) => files.filter((f) => f.orcamentoId === orcamentoId);
  const getFilesByTask = (taskId: string) => files.filter((f) => f.taskId === taskId);

  return {
    files,
    uploading,
    uploadFile,
    deleteFile,
    getFilesByClient,
    getFilesByOrcamento,
    getFilesByTask,
    loadFiles,
  };
}
