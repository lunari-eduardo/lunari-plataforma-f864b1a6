/**
 * Hook for optimistic updates with automatic rollback
 * Provides instant UI feedback while syncing to Supabase
 */

import { useState, useCallback, useRef } from 'react';
import { toast } from 'sonner';

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

  const operations: OptimisticOperations<T> = {
    
    add: useCallback(async (item: T, persistFn: () => Promise<void>) => {
      const operationId = `add_${item.id}`;
      
      // Optimistic update
      setState(prev => ({
        ...prev,
        data: [...prev.data, item],
        pending: new Set([...prev.pending, operationId]),
        syncing: true
      }));

      rollbackRef.current.set(operationId, { type: 'add' });

      try {
        await persistFn();
        
        // Success - remove from pending
        setState(prev => ({
          ...prev,
          pending: new Set([...prev.pending].filter(id => id !== operationId)),
          syncing: prev.pending.size <= 1
        }));
        
        rollbackRef.current.delete(operationId);
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
        throw error;
      }
    }, []),

    update: useCallback(async (id: string, updates: Partial<T>, persistFn: () => Promise<void>) => {
      const operationId = `update_${id}`;
      
      // Store previous state for rollback
      const previousItem = state.data.find(item => item.id === id);
      if (!previousItem) return;

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
        await persistFn();
        
        // Success - remove from pending
        setState(prev => ({
          ...prev,
          pending: new Set([...prev.pending].filter(pid => pid !== operationId)),
          syncing: prev.pending.size <= 1
        }));
        
        rollbackRef.current.delete(operationId);
      } catch (error) {
        console.error('Failed to update item:', error);
        
        // Rollback to previous state
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
        throw error;
      }
    }, [state.data]),

    remove: useCallback(async (id: string, persistFn: () => Promise<void>) => {
      const operationId = `remove_${id}`;
      
      // Store item for rollback
      const itemToRemove = state.data.find(item => item.id === id);
      if (!itemToRemove) return;

      // Optimistic update
      setState(prev => ({
        ...prev,
        data: prev.data.filter(item => item.id !== id),
        pending: new Set([...prev.pending, operationId]),
        syncing: true
      }));

      rollbackRef.current.set(operationId, { type: 'remove', previous: itemToRemove });

      try {
        await persistFn();
        
        // Success - remove from pending  
        setState(prev => ({
          ...prev,
          pending: new Set([...prev.pending].filter(pid => pid !== operationId)),
          syncing: prev.pending.size <= 1
        }));
        
        rollbackRef.current.delete(operationId);
      } catch (error) {
        console.error('Failed to remove item:', error);
        
        // Rollback - restore item
        setState(prev => ({
          ...prev,
          data: [...prev.data, itemToRemove],
          pending: new Set([...prev.pending].filter(pid => pid !== operationId)),
          syncing: prev.pending.size <= 1
        }));
        
        rollbackRef.current.delete(operationId);
        toast.error('Erro ao salvar. Alteração revertida.');
        throw error;
      }
    }, [state.data]),

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