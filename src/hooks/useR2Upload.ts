import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface UseR2UploadOptions {
  context: 'blog' | 'form' | 'task' | 'general';
  onSuccess?: (url: string) => void;
  onError?: (error: string) => void;
}

export function useR2Upload({ context, onSuccess, onError }: UseR2UploadOptions) {
  const [uploading, setUploading] = useState(false);

  const uploadFile = useCallback(async (file: File): Promise<string | null> => {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('context', context);

      const { data, error } = await supabase.functions.invoke('r2-media-upload', {
        body: formData,
      });

      if (error) throw new Error(error.message || 'Erro no upload');
      if (!data?.success) throw new Error(data?.error || 'Upload falhou');

      const url = data.url as string;
      onSuccess?.(url);
      return url;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao enviar arquivo';
      toast.error(msg);
      onError?.(msg);
      return null;
    } finally {
      setUploading(false);
    }
  }, [context, onSuccess, onError]);

  return { uploadFile, uploading };
}
