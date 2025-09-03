import { useState, useCallback } from 'react';
import { toast } from 'sonner';

interface UseImageUploadOptions {
  onSuccess: (dataUrl: string, fileName: string) => void;
  maxSize?: number;
  accept?: string;
}

export function useImageUpload({ 
  onSuccess, 
  maxSize = 5 * 1024 * 1024, 
  accept = 'image/*' 
}: UseImageUploadOptions) {
  const [isUploading, setIsUploading] = useState(false);

  const handleFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validar tipo de arquivo
    if (!file.type.startsWith('image/')) {
      toast.error('Selecione uma imagem válida');
      return;
    }

    // Validar tamanho
    if (file.size > maxSize) {
      toast.error(`Arquivo muito grande. Máximo ${Math.round(maxSize / (1024 * 1024))}MB`);
      return;
    }

    setIsUploading(true);

    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      onSuccess(dataUrl, file.name);
      setIsUploading(false);
    };

    reader.onerror = () => {
      toast.error('Erro ao processar imagem');
      setIsUploading(false);
    };

    reader.readAsDataURL(file);
  }, [onSuccess, maxSize]);

  return {
    handleFileUpload,
    isUploading
  };
}