import { useSupabaseLeads } from './useSupabaseLeads';

/**
 * Hook para gerenciar leads - delega 100% para Supabase
 * Mantém compatibilidade com interface anterior
 */
export function useLeads() {
  const {
    leads,
    isLoading,
    addLead,
    updateLead,
    deleteLead,
    convertToClient,
  } = useSupabaseLeads();

  return {
    leads,
    isLoading,
    addLead,
    updateLead,
    deleteLead,
    convertToClient,
  };
}
