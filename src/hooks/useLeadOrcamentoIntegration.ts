import { useEffect } from 'react';
import { useLeadOrcamentoSync } from './useLeadOrcamentoSync';
import { useAppContext } from '@/contexts/AppContext';

/**
 * Integration hook that automatically sets up the lead-budget synchronization
 * Include this in your main app or layout component to enable the sync
 */
export function useLeadOrcamentoIntegration() {
  useLeadOrcamentoSync();
  
  useEffect(() => {
    console.log('✅ Lead ↔ Orçamento synchronization system activated');
  }, []);
  
  return {};
}