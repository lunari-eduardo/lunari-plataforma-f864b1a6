import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { gestaoR2Upload } from '@/lib/gestaoR2Upload';

export type R2Context =
  | 'avatar'
  | 'logo'
  | 'blog'
  | 'form'
  | 'task'
  | 'client-document'
  | 'contrato-assinado'
  | 'general';

export interface R2UploadResult {
  url: string;          // CDN URL se público; vazio se privado
  storagePath: string;  // chave no R2 — sempre presente
  isPublic: boolean;
  filename: string;
  fileSize: number;
  mimeType: string;
}

interface UseR2UploadOptions {
  context: R2Context;
  entityId?: string;
  onSuccess?: (result: R2UploadResult) => void;
  onError?: (error: string) => void;
}

export function useR2Upload({ context, entityId, onSuccess, onError }: UseR2UploadOptions) {
  const [uploading, setUploading] = useState(false);

  const uploadFile = useCallback(
    async (file: File, overrideEntityId?: string): Promise<R2UploadResult | null> => {
      setUploading(true);
      try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('context', context);
        const eid = overrideEntityId ?? entityId;
        if (eid) formData.append('entityId', eid);

        const { data, error } = await supabase.functions.invoke('gestao-r2-upload', {
          body: formData,
        });

        if (error) {
          // Tentar extrair mensagem real da Edge Function (não fica em error.message).
          let detail = error.message || 'Erro no upload';
          try {
            const ctx: any = (error as any).context;
            if (ctx?.json) {
              const body = await ctx.json();
              if (body?.error) detail = String(body.error);
            } else if (ctx?.text) {
              const txt = await ctx.text();
              try {
                const parsed = JSON.parse(txt);
                if (parsed?.error) detail = String(parsed.error);
              } catch {}
            }
          } catch {}
          throw new Error(detail);
        }
        if (!data?.success) throw new Error(data?.error || 'Upload falhou');

        const result: R2UploadResult = {
          url: data.url || '',
          storagePath: data.storagePath,
          isPublic: !!data.isPublic,
          filename: data.filename,
          fileSize: data.fileSize,
          mimeType: data.mimeType,
        };
        onSuccess?.(result);
        return result;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Erro ao enviar arquivo';
        toast.error(msg);
        onError?.(msg);
        return null;
      } finally {
        setUploading(false);
      }
    },
    [context, entityId, onSuccess, onError]
  );

  return { uploadFile, uploading };
}
