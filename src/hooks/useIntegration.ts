
import { useCallback } from 'react';
import { Appointment } from './useAgenda';

export const useIntegration = () => {
  // Todas as funções de integração foram movidas para o AppContext
  // Este hook agora serve apenas como uma interface para as funções de utilidade
  
  const isFromBudget = useCallback((appointment: Appointment) => {
    return appointment.id?.startsWith('orcamento-') || (appointment as any).origem === 'orcamento';
  }, []);
  
  const getBudgetId = useCallback((appointment: Appointment) => {
    if (appointment.id?.startsWith('orcamento-')) {
      return appointment.id.replace('orcamento-', '');
    }
    return (appointment as any).orcamentoId;
  }, []);
  
  const canEditFully = useCallback((appointment: Appointment) => {
    // Agendamentos de orçamentos só podem editar data/hora na agenda
    return !(appointment.id?.startsWith('orcamento-') || (appointment as any).origem === 'orcamento');
  }, []);

  return {
    // Funções de utilidade para identificar origem dos agendamentos
    isFromBudget,
    getBudgetId,
    canEditFully
  };
};
