import { useSupabaseLeadStatuses } from './useSupabaseLeadStatuses';
import type { LeadStatusDef } from '@/types/leads';

// Re-export LeadStatusDef for backwards compatibility
export type { LeadStatusDef };

/**
 * Hook para gerenciar status de leads - agora usando Supabase
 * Mantém compatibilidade com interface anterior
 */
export const useLeadStatuses = () => {
  const {
    statuses,
    isLoading,
    addStatus,
    updateStatus,
    removeStatus,
    moveStatus,
    getConvertedKey,
    getDefaultOpenKey,
  } = useSupabaseLeadStatuses();

  return {
    statuses,
    isLoading,
    addStatus,
    updateStatus,
    removeStatus,
    moveStatus,
    getConvertedKey,
    getDefaultOpenKey,
  };
};
