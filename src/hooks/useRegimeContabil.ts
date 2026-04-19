/**
 * Hook para gerenciar regime contábil (caixa | competencia)
 * com persistência em localStorage e sincronização entre abas
 */

import { useState, useEffect, useCallback } from 'react';
import { RegimeContabil } from './useExtratoSupabase';

const STORAGE_KEY = 'extrato_regime_default';
const REGIME_CHANGE_EVENT = 'lunari:regime-changed';

function readStoredRegime(): RegimeContabil {
  if (typeof window === 'undefined') return 'caixa';
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored === 'competencia' ? 'competencia' : 'caixa';
  } catch {
    return 'caixa';
  }
}

export function useRegimeContabil() {
  const [regime, setRegimeState] = useState<RegimeContabil>(() => readStoredRegime());

  const setRegime = useCallback((novoRegime: RegimeContabil) => {
    setRegimeState(novoRegime);
    try {
      window.localStorage.setItem(STORAGE_KEY, novoRegime);
      // Notifica outras instâncias (Dashboard ↔ Extrato)
      window.dispatchEvent(new CustomEvent(REGIME_CHANGE_EVENT, { detail: novoRegime }));
    } catch (e) {
      console.warn('Falha ao persistir regime contábil', e);
    }
  }, []);

  // Sincroniza com mudanças em outras instâncias / abas
  useEffect(() => {
    const handleCustom = (e: Event) => {
      const detail = (e as CustomEvent).detail as RegimeContabil;
      if (detail === 'caixa' || detail === 'competencia') {
        setRegimeState(detail);
      }
    };
    const handleStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && (e.newValue === 'caixa' || e.newValue === 'competencia')) {
        setRegimeState(e.newValue);
      }
    };

    window.addEventListener(REGIME_CHANGE_EVENT, handleCustom);
    window.addEventListener('storage', handleStorage);
    return () => {
      window.removeEventListener(REGIME_CHANGE_EVENT, handleCustom);
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  return { regime, setRegime };
}
