import { useCallback } from 'react';
import { toast } from 'sonner';
import type { Task, TaskCaption } from '@/types/tasks';

export function useTaskCaptions(task: Task, onUpdateTask: (updates: Partial<Task>) => void) {
  const addCaption = useCallback((captionData: Omit<TaskCaption, 'id' | 'createdAt'>) => {
    const caption: TaskCaption = {
      ...captionData,
      id: `caption_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date().toISOString()
    };

    const currentCaptions = task.captions || [];
    onUpdateTask({
      captions: [...currentCaptions, caption]
    });

    toast.success('Legenda salva com sucesso!');
  }, [task.captions, onUpdateTask]);

  const updateCaption = useCallback((captionId: string, updates: Partial<TaskCaption>) => {
    const currentCaptions = task.captions || [];
    const updatedCaptions = currentCaptions.map(c => 
      c.id === captionId ? { ...c, ...updates } : c
    );

    onUpdateTask({
      captions: updatedCaptions
    });

    toast.success('Legenda atualizada');
  }, [task.captions, onUpdateTask]);

  const removeCaption = useCallback((captionId: string) => {
    const currentCaptions = task.captions || [];
    const updatedCaptions = currentCaptions.filter(c => c.id !== captionId);

    onUpdateTask({
      captions: updatedCaptions
    });

    toast.success('Legenda removida');
  }, [task.captions, onUpdateTask]);

  return {
    addCaption,
    updateCaption,
    removeCaption
  };
}