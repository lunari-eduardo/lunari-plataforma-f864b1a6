import { useState, useCallback } from 'react';
import { toast } from 'sonner';

export interface UploadedFile {
  id: string;
  nome: string;
  tipo: string;
  tamanho: number;
  url: string;
  uploadDate: string;
  clienteId?: string;
  orcamentoId?: string;
  description?: string;
}

export function useFileUpload() {
  const [uploading, setUploading] = useState(false);
  const [files, setFiles] = useState<UploadedFile[]>([]);

  // Carregar arquivos do localStorage
  const loadFiles = useCallback(() => {
    try {
      const saved = localStorage.getItem('uploaded_files');
      const uploadedFiles = saved ? JSON.parse(saved) : [];
      setFiles(uploadedFiles);
    } catch (error) {
      console.error('❌ Erro ao carregar arquivos:', error);
      setFiles([]);
    }
  }, []);

  // Salvar arquivos no localStorage
  const saveFiles = (newFiles: UploadedFile[]) => {
    try {
      localStorage.setItem('uploaded_files', JSON.stringify(newFiles));
      setFiles(newFiles);
    } catch (error) {
      console.error('❌ Erro ao salvar arquivos:', error);
      toast.error('Erro ao salvar arquivo');
    }
  };

  // Upload de arquivo (simula upload - converte para base64)
  const uploadFile = async (
    file: File, 
    metadata: { 
      clienteId?: string; 
      orcamentoId?: string; 
      description?: string; 
    } = {}
  ): Promise<UploadedFile | null> => {
    if (!file) return null;

    // Validar tipo de arquivo
    const allowedTypes = [
      'application/pdf', 
      'image/jpeg', 
      'image/png', 
      'image/jpg',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];

    if (!allowedTypes.includes(file.type)) {
      toast.error('Tipo de arquivo não permitido. Use PDF, JPG, PNG ou DOC');
      return null;
    }

    // Validar tamanho (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Arquivo muito grande. Tamanho máximo: 10MB');
      return null;
    }

    setUploading(true);

    try {
      // Converter arquivo para base64 (simulação de upload)
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const uploadedFile: UploadedFile = {
        id: `file_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        nome: file.name,
        tipo: file.type,
        tamanho: file.size,
        url: base64, // Em produção seria uma URL real
        uploadDate: new Date().toISOString(),
        ...metadata
      };

      const currentFiles = [...files, uploadedFile];
      saveFiles(currentFiles);

      toast.success('Arquivo enviado com sucesso!');
      return uploadedFile;

    } catch (error) {
      console.error('❌ Erro no upload:', error);
      toast.error('Erro ao fazer upload do arquivo');
      return null;
    } finally {
      setUploading(false);
    }
  };

  // Deletar arquivo
  const deleteFile = (fileId: string) => {
    const updatedFiles = files.filter(f => f.id !== fileId);
    saveFiles(updatedFiles);
    toast.success('Arquivo removido');
  };

  // Buscar arquivos por cliente
  const getFilesByClient = (clienteId: string) => {
    return files.filter(f => f.clienteId === clienteId);
  };

  // Buscar arquivos por orçamento
  const getFilesByOrcamento = (orcamentoId: string) => {
    return files.filter(f => f.orcamentoId === orcamentoId);
  };

  return {
    files,
    uploading,
    uploadFile,
    deleteFile,
    getFilesByClient,
    getFilesByOrcamento,
    loadFiles
  };
}