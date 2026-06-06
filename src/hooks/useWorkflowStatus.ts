import { useMemo, useCallback } from 'react';
import { useRealtimeConfiguration } from '@/hooks/useRealtimeConfiguration';
import { useAccessControl } from '@/hooks/useAccessControl';

export const useWorkflowStatus = () => {
  // Use Supabase data instead of localStorage
  const { etapas: workflowStatuses } = useRealtimeConfiguration();
  const { hasGaleryAccess } = useAccessControl();

  // Etapas visíveis no workflow:
  // - Etapas comuns: respeitam is_hidden_in_workflow
  // - Etapas de sistema (Gallery): se usuário tem Gallery ativo, sempre visíveis
  //   (override automático para não quebrar o fluxo)
  const visibleStatuses = useMemo(() => {
    return workflowStatuses.filter(s => {
      if (!s.is_hidden_in_workflow) return true;
      if (s.is_system_status && hasGaleryAccess) return true;
      return false;
    });
  }, [workflowStatuses, hasGaleryAccess]);

  const getStatusOptions = useMemo(() => {
    return visibleStatuses.map(status => status.nome);
  }, [visibleStatuses]);

  const getStatusColor = useCallback((statusName: string) => {
    const status = workflowStatuses.find(s => s.nome === statusName);
    return status?.cor || '#6B7280';
  }, [workflowStatuses]);

  const getAllStatuses = useMemo(() => {
    return ['Confirmado', ...visibleStatuses.map(s => s.nome)];
  }, [visibleStatuses]);

  return {
    workflowStatuses: visibleStatuses,
    allWorkflowStatuses: workflowStatuses,
    getStatusOptions,
    getStatusColor,
    getAllStatuses
  };
};

