import { useCallback } from 'react';
import { useLeads } from './useLeads';
import type { Lead } from '@/types/leads';
import type { LeadInteraction } from '@/types/leadInteractions';

export function useLeadInteractions() {
  const { updateLead } = useLeads();

  const addInteraction = useCallback((
    leadId: string, 
    tipo: LeadInteraction['tipo'], 
    descricao: string, 
    automatica: boolean = false,
    detalhes?: string,
    statusAnterior?: string,
    statusNovo?: string
  ) => {
    const interaction: LeadInteraction = {
      id: `interaction_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      leadId,
      tipo,
      descricao,
      timestamp: new Date().toISOString(),
      automatica,
      detalhes,
      statusAnterior,
      statusNovo
    };

    // IMPORTANTE: Não espalhar currentLead inteiro para evitar race condition
    // Apenas atualiza interacoes e ultimaInteracao, preservando status atual no banco
    updateLead(leadId, (currentLead) => ({
      interacoes: [interaction, ...(currentLead.interacoes || [])],
      ultimaInteracao: new Date().toISOString()
    } as Partial<Lead> as Lead));

    return interaction;
  }, [updateLead]);

  const getInteractionsForLead = useCallback((lead: Lead): LeadInteraction[] => {
    return lead.interacoes || [];
  }, []);

  const getLastInteraction = useCallback((lead: Lead): LeadInteraction | null => {
    const interactions = getInteractionsForLead(lead);
    return interactions.length > 0 ? interactions[0] : null;
  }, [getInteractionsForLead]);

  return {
    addInteraction,
    getInteractionsForLead,
    getLastInteraction
  };
}