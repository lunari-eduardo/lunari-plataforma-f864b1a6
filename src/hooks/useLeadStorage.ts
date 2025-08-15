import { useCallback } from 'react';
import { storage, STORAGE_KEYS } from '@/utils/localStorage';
import type { Lead } from '@/types/leads';

/**
 * Hook especializado para storage de leads
 * Implementa transações atômicas e previne race conditions
 */
export function useLeadStorage() {
  const saveLeads = useCallback((leads: Lead[]) => {
    try {
      console.log('💾 [LeadStorage] Salvando leads:', leads.length);
      storage.save(STORAGE_KEYS.LEADS, leads);
      
      // Dispatch event para notificar mudanças
      window.dispatchEvent(new CustomEvent('leads:changed', { 
        detail: { count: leads.length } 
      }));
      
      return true;
    } catch (error) {
      console.error('❌ [LeadStorage] Erro ao salvar leads:', error);
      return false;
    }
  }, []);

  const loadLeads = useCallback((): Lead[] => {
    try {
      const leads = storage.load<Lead[]>(STORAGE_KEYS.LEADS, []);
      console.log('📥 [LeadStorage] Leads carregados:', leads.length);
      return leads;
    } catch (error) {
      console.error('❌ [LeadStorage] Erro ao carregar leads:', error);
      return [];
    }
  }, []);

  const atomicUpdate = useCallback((updater: (current: Lead[]) => Lead[]): Lead[] => {
    try {
      const current = loadLeads();
      const updated = updater(current);
      
      if (saveLeads(updated)) {
        console.log('✅ [LeadStorage] Update atômico bem-sucedido');
        return updated;
      } else {
        console.error('❌ [LeadStorage] Falha no update atômico, mantendo estado atual');
        return current;
      }
    } catch (error) {
      console.error('❌ [LeadStorage] Erro no update atômico:', error);
      return loadLeads(); // Fallback to current state
    }
  }, [loadLeads, saveLeads]);

  return {
    saveLeads,
    loadLeads,
    atomicUpdate
  };
}