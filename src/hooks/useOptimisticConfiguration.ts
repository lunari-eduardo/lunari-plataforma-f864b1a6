/**
 * Hook for optimistic updates with automatic rollback
 * WITH QUEUE-BASED SEQUENTIAL PROCESSING (NO LOCKS)
 */

import { useState, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import debounce from 'lodash.debounce';

const OPTIMISTIC_DEBUG = false; // Set to true for debugging

interface OptimisticState<T> {
  data: T[];
  pending: Set<string>;
  syncing: boolean;
}

interface OptimisticOperations<T> {
  add: (item: T, persistFn: () => Promise<void>) => Promise<void>;
  update: (id: string, updates: Partial<T>, persistFn: () => Promise<void>) => Promise<void>;
  remove: (id: string, persistFn: () => Promise<void>) => Promise<void>;
  set: (data: T[]) => void;
  rollback: (operation: string, id?: string) => void;
}

export function useOptimisticConfiguration<T extends { id: string }>(
  initialData: T[] = []
): [OptimisticState<T>, OptimisticOperations<T>] {
  
  const [state, setState] = useState<OptimisticState<T>>({
    data: initialData,
    pending: new Set(),
    syncing: false
  });

  const rollbackRef = useRef<Map<string, { type: 'add' | 'update' | 'remove', previous?: T }>>(new Map());
  
  // Queue for sequential processing
  const operationQueueRef = useRef<Array<() => Promise<void>>>([]);
  const isProcessingRef = useRef<boolean>(false);
  
  // Reduced debounce to 100ms (was 300ms)
  const debouncedPersist = useRef(
    debounce(async (persistFn: () => Promise<void>) => {
      try {
        await persistFn();
      } catch (error) {
        throw error;
      }
    }, 100) // Reduced from 300ms
  ).current;

  // Process queue sequentially
  const processQueue = useCallback(async () => {
    if (isProcessingRef.current || operationQueueRef.current.length === 0) {
      return;
    }

    isProcessingRef.current = true;

    while (operationQueueRef.current.length > 0) {
      const operation = operationQueueRef.current.shift();
      if (operation) {
        try {
          await operation();
        } catch (error) {
          if (OPTIMISTIC_DEBUG) console.error('❌ Queue operation failed:', error);
        }
      }
    }

    isProcessingRef.current = false;
  }, []);

  const operations: OptimisticOperations<T> = {
    
    add: useCallback(async (item: T, persistFn: () => Promise<void>) => {
      const operationId = `add_${item.id}_${Date.now()}`;
      
      if (OPTIMISTIC_DEBUG) console.log(`➕ [ADD] Queueing operation ${operationId}`);
      
      return new Promise((resolve, reject) => {
        operationQueueRef.current.push(async () => {
          // Optimistic update
          setState(prev => ({
            ...prev,
            data: [...prev.data, item],
            pending: new Set([...prev.pending, operationId]),
            syncing: true
          }));

          rollbackRef.current.set(operationId, { type: 'add' });

          try {
            await debouncedPersist(persistFn);
            
            // Success
            setState(prev => ({
              ...prev,
              pending: new Set([...prev.pending].filter(id => id !== operationId)),
              syncing: prev.pending.size <= 1
            }));
            
            rollbackRef.current.delete(operationId);
            if (OPTIMISTIC_DEBUG) console.log(`✅ [ADD] Completed ${operationId}`);
            resolve();
          } catch (error) {
            console.error('Failed to add item:', error);
            
            // Rollback
            setState(prev => ({
              ...prev,
              data: prev.data.filter(i => i.id !== item.id),
              pending: new Set([...prev.pending].filter(id => id !== operationId)),
              syncing: prev.pending.size <= 1
            }));
            
            rollbackRef.current.delete(operationId);
            toast.error('Erro ao salvar. Alteração revertida.');
            reject(error);
          }
        });

        processQueue();
      });
    }, [debouncedPersist, processQueue]),

    update: useCallback(async (id: string, updates: Partial<T>, persistFn: () => Promise<void>) => {
      const operationId = `update_${id}_${Date.now()}`;
      
      if (OPTIMISTIC_DEBUG) console.log(`🔄 [UPDATE] Queueing operation ${operationId}`);
      
      return new Promise((resolve, reject) => {
        operationQueueRef.current.push(async () => {
          const previousItem = state.data.find(item => item.id === id);
          if (!previousItem) {
            reject(new Error('Item not found'));
            return;
          }

          // Optimistic update
          setState(prev => ({
            ...prev,
            data: prev.data.map(item => 
              item.id === id ? { ...item, ...updates } : item
            ),
            pending: new Set([...prev.pending, operationId]),
            syncing: true
          }));

          rollbackRef.current.set(operationId, { type: 'update', previous: previousItem });

          try {
            await debouncedPersist(persistFn);
            
            // Success
            setState(prev => ({
              ...prev,
              pending: new Set([...prev.pending].filter(pid => pid !== operationId)),
              syncing: prev.pending.size <= 1
            }));
            
            rollbackRef.current.delete(operationId);
            if (OPTIMISTIC_DEBUG) console.log(`✅ [UPDATE] Completed ${operationId}`);
            resolve();
          } catch (error) {
            console.error('Failed to update item:', error);
            
            // Rollback
            setState(prev => ({
              ...prev,
              data: prev.data.map(item => 
                item.id === id ? previousItem : item
              ),
              pending: new Set([...prev.pending].filter(pid => pid !== operationId)),
              syncing: prev.pending.size <= 1
            }));
            
            rollbackRef.current.delete(operationId);
            toast.error('Erro ao salvar. Alteração revertida.');
            reject(error);
          }
        });

        processQueue();
      });
    }, [state.data, debouncedPersist, processQueue]),

    remove: useCallback(async (id: string, persistFn: () => Promise<void>) => {
      const operationId = `remove_${id}_${Date.now()}`;
      
      if (OPTIMISTIC_DEBUG) console.log(`🗑️ [REMOVE] Queueing operation ${operationId}`);
      
      return new Promise((resolve, reject) => {
        operationQueueRef.current.push(async () => {
          const itemToRemove = state.data.find(item => item.id === id);
          if (!itemToRemove) {
            reject(new Error('Item not found'));
            return;
          }

          // Optimistic update
          setState(prev => ({
            ...prev,
            data: prev.data.filter(item => item.id !== id),
            pending: new Set([...prev.pending, operationId]),
            syncing: true
          }));

          rollbackRef.current.set(operationId, { type: 'remove', previous: itemToRemove });

          try {
            await debouncedPersist(persistFn);
            
            // Success
            setState(prev => ({
              ...prev,
              pending: new Set([...prev.pending].filter(pid => pid !== operationId)),
              syncing: prev.pending.size <= 1
            }));
            
            rollbackRef.current.delete(operationId);
            if (OPTIMISTIC_DEBUG) console.log(`✅ [REMOVE] Completed ${operationId}`);
            resolve();
          } catch (error) {
            console.error('Failed to remove item:', error);
            
            // Rollback
            setState(prev => ({
              ...prev,
              data: [...prev.data, itemToRemove],
              pending: new Set([...prev.pending].filter(pid => pid !== operationId)),
              syncing: prev.pending.size <= 1
            }));
            
            rollbackRef.current.delete(operationId);
            toast.error('Erro ao salvar. Alteração revertida.');
            reject(error);
          }
        });

        processQueue();
      });
    }, [state.data, debouncedPersist, processQueue]),

    set: useCallback((data: T[]) => {
      setState(prev => ({
        ...prev,
        data,
        syncing: false
      }));
    }, []),

    rollback: useCallback((operation: string, id?: string) => {
      const rollbackData = rollbackRef.current.get(operation);
      if (!rollbackData) return;

      setState(prev => {
        let newData = [...prev.data];
        
        switch (rollbackData.type) {
          case 'add':
            newData = prev.data.filter(item => item.id !== id);
            break;
          case 'update':
            if (rollbackData.previous && id) {
              newData = prev.data.map(item => 
                item.id === id ? rollbackData.previous! : item
              );
            }
            break;
          case 'remove':
            if (rollbackData.previous) {
              newData = [...prev.data, rollbackData.previous];
            }
            break;
        }

        return {
          ...prev,
          data: newData,
          pending: new Set([...prev.pending].filter(pid => pid !== operation))
        };
      });

      rollbackRef.current.delete(operation);
    }, [])
  };

  return [state, operations];
}