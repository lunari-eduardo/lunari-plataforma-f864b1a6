
import { useMemo } from 'react';
import { storage, STORAGE_KEYS } from '@/utils/localStorage';

interface WorkflowStatus {
  id: string;
  nome: string;
  cor: string;
  ordem: number;
}

export const useWorkflowStatus = () => {
  const workflowStatuses = useMemo(() => {
    const configuredStatuses = storage.load<WorkflowStatus[]>(STORAGE_KEYS.WORKFLOW_STATUS, []);
    return configuredStatuses.sort((a, b) => a.ordem - b.ordem);
  }, []);

  const getStatusOptions = () => {
    return workflowStatuses.map(status => status.nome);
  };

  const getStatusColor = (statusName: string) => {
    const status = workflowStatuses.find(s => s.nome === statusName);
    return status?.cor || '#6B7280';
  };

  const getAllStatuses = () => {
    return ['Confirmado', ...workflowStatuses.map(s => s.nome)];
  };

  return {
    workflowStatuses,
    getStatusOptions,
    getStatusColor,
    getAllStatuses
  };
};
