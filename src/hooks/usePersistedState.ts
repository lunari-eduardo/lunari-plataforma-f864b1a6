import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * Hook para persistir estado em sessionStorage (ou localStorage).
 * Útil para manter estado de navegação ao minimizar/reabrir PWA.
 * 
 * @param key - Chave única para armazenamento
 * @param defaultValue - Valor padrão se não houver valor salvo
 * @param storage - Storage a usar (sessionStorage por padrão)
 */
export function usePersistedState<T>(
  key: string,
  defaultValue: T,
  storage: Storage = typeof window !== 'undefined' ? sessionStorage : null as any
): [T, (value: T | ((prev: T) => T)) => void] {
  // Flag para evitar hydration mismatch
  const isInitialized = useRef(false);
  
  // Inicializar com valor persistido ou default
  const [state, setState] = useState<T>(() => {
    if (typeof window === 'undefined' || !storage) {
      return defaultValue;
    }
    
    try {
      const stored = storage.getItem(key);
      if (stored) {
        const parsed = JSON.parse(stored);
        isInitialized.current = true;
        return parsed;
      }
    } catch (e) {
      console.warn(`[usePersistedState] Error reading ${key}:`, e);
    }
    return defaultValue;
  });

  // Persistir quando mudar
  useEffect(() => {
    if (typeof window === 'undefined' || !storage) return;
    
    try {
      storage.setItem(key, JSON.stringify(state));
    } catch (e) {
      console.warn(`[usePersistedState] Error saving ${key}:`, e);
    }
  }, [key, state, storage]);

  // Wrapper para setState que também aceita função
  const setPersistedState = useCallback((value: T | ((prev: T) => T)) => {
    setState(prev => {
      const nextValue = typeof value === 'function' ? (value as (prev: T) => T)(prev) : value;
      return nextValue;
    });
  }, []);

  return [state, setPersistedState];
}
