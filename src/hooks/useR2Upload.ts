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
        const eid = overrideEntityId ?? entityId;
        const data = await gestaoR2Upload({ file, context, entityId: eid });

        const result: R2UploadResult = {
          url: data.url || '',
          storagePath: data.storagePath,
          isPublic: !!data.isPublic,
          filename: data.filename ?? file.name,
          fileSize: data.fileSize ?? file.size,
          mimeType: data.mimeType ?? file.type,
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
