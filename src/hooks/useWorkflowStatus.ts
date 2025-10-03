import { useMemo } from 'react';
import { useRealtimeConfiguration } from '@/hooks/useRealtimeConfiguration';

export const useWorkflowStatus = () => {
  // Use Supabase data instead of localStorage
  const { etapas: workflowStatuses } = useRealtimeConfiguration();

  // Debug log to verify etapas are loading
  useMemo(() => {
    console.log('📋 Workflow statuses from Supabase:', workflowStatuses);
    console.log('📊 Total etapas:', workflowStatuses.length);
  }, [workflowStatuses]);

  const getStatusOptions = useMemo(() => {
    const options = workflowStatuses.map(status => status.nome);
    console.log('✅ Status options generated:', options);
    return options;
  }, [workflowStatuses]);

  const getStatusColor = useMemo(() => (statusName: string) => {
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
