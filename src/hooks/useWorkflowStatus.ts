import { useMemo, useCallback } from 'react';
import { useRealtimeConfiguration } from '@/hooks/useRealtimeConfiguration';

export const useWorkflowStatus = () => {
  // Use Supabase data instead of localStorage
  const { etapas: workflowStatuses } = useRealtimeConfiguration();

  const getStatusOptions = useMemo(() => {
    return workflowStatuses.map(status => status.nome);
  }, [workflowStatuses]);

  const getStatusColor = useCallback((statusName: string) => {
    const status = workflowStatuses.find(s => s.nome === statusName);
    return status?.cor || '#6B7280';
  }, [workflowStatuses]);

  const getAllStatuses = useMemo(() => {
    return ['Confirmado', ...workflowStatuses.map(s => s.nome)];
  }, [workflowStatuses]);

  return {
    workflowStatuses,
    getStatusOptions,
    getStatusColor,
    getAllStatuses
  };
};
