import { useCallback } from 'react';
import { toast } from 'sonner';
import type { Task, TaskAttachment } from '@/types/tasks';

export function useTaskAttachments(task: Task, onUpdateTask: (updates: Partial<Task>) => void) {
  const uploadAttachment = useCallback(async (file: File): Promise<void> => {
    if (!file) return;

    // Validar tipo de arquivo
    const allowedTypes = [
      'application/pdf', 
      'image/jpeg', 
      'image/png', 
      'image/jpg',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain'
    ];

    if (!allowedTypes.includes(file.type)) {
      toast.error('Tipo de arquivo não permitido');
      return;
    }

    // Validar tamanho (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Arquivo muito grande. Tamanho máximo: 10MB');
      return;
    }

    try {
      let content: string | undefined;
      let url: string | undefined;

      // Para textos, ler o conteúdo
      if (file.type === 'text/plain') {
        content = await file.text();
      } else {
        // Para outros arquivos, converter para base64
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
        url = base64;
      }

      const attachment: TaskAttachment = {
        id: `attachment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name: file.name,
        type: file.type.startsWith('image/') ? 'image' : 
              file.type === 'text/plain' ? 'text' : 'document',
        url,
        content,
        uploadedAt: new Date().toISOString(),
        size: file.size,
        mimeType: file.type
      };

      const currentAttachments = task.attachments || [];
      onUpdateTask({
        attachments: [...currentAttachments, attachment]
      });

      toast.success('Anexo adicionado com sucesso!');
    } catch (error) {
      console.error('❌ Erro ao adicionar anexo:', error);
      toast.error('Erro ao adicionar anexo');
    }
  }, [task.attachments, onUpdateTask]);

  const removeAttachment = useCallback((attachmentId: string) => {
    const currentAttachments = task.attachments || [];
    const updatedAttachments = currentAttachments.filter(a => a.id !== attachmentId);
    
    onUpdateTask({
      attachments: updatedAttachments
    });

    toast.success('Anexo removido');
  }, [task.attachments, onUpdateTask]);

  const addTextAttachment = useCallback((name: string, content: string) => {
    const attachment: TaskAttachment = {
      id: `attachment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name,
      type: 'text',
      content,
      uploadedAt: new Date().toISOString()
    };

    const currentAttachments = task.attachments || [];
    onUpdateTask({
      attachments: [...currentAttachments, attachment]
    });

    toast.success('Texto adicionado com sucesso!');
  }, [task.attachments, onUpdateTask]);

  return {
    uploadAttachment,
    removeAttachment,
    addTextAttachment
  };
}