import { useEffect, useRef, useCallback } from 'react';
import { useDebounce } from '@/hooks/useDebounce';

interface UseAutoSaveOptions<T> {
  data: T;
  onSave: (data: T) => Promise<boolean>;
  delay?: number;
  enabled?: boolean;
}

export function useAutoSave<T>({ 
  data, 
  onSave, 
  delay = 2000, 
  enabled = true 
}: UseAutoSaveOptions<T>) {
  const debouncedData = useDebounce(data, delay);
  const initialDataRef = useRef<T>(data);
  const isSavingRef = useRef(false);

  const saveData = useCallback(async () => {
    if (!enabled || isSavingRef.current) return;
    
    // Evitar salvar dados iniciais
    if (JSON.stringify(debouncedData) === JSON.stringify(initialDataRef.current)) {
      return;
    }

    isSavingRef.current = true;
    try {
      await onSave(debouncedData);
    } catch (error) {
      console.error('Auto-save failed:', error);
    } finally {
      isSavingRef.current = false;
    }
  }, [debouncedData, onSave, enabled]);

  useEffect(() => {
    saveData();
  }, [saveData]);

  return {
    isSaving: isSavingRef.current
  };
}