
import { useMemo, useEffect, useState } from 'react';
import { storage, STORAGE_KEYS } from '@/utils/localStorage';

interface WorkflowStatus {
  id: string;
  nome: string;
  cor: string;
  ordem: number;
}

export const useWorkflowStatus = () => {
  const [storageUpdate, setStorageUpdate] = useState(0);

  // Força atualização quando o localStorage muda
  useEffect(() => {
    const handleStorageChange = () => {
      setStorageUpdate(prev => prev + 1);
    };

    const handleWorkflowUpdate = () => {
      setStorageUpdate(prev => prev + 1);
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('workflowStatusUpdated', handleWorkflowUpdate);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('workflowStatusUpdated', handleWorkflowUpdate);
    };
  }, []);

  const workflowStatuses = useMemo(() => {
    const configuredStatuses = storage.load<WorkflowStatus[]>(STORAGE_KEYS.WORKFLOW_STATUS, []);
    return configuredStatuses.sort((a, b) => a.ordem - b.ordem);
  }, [storageUpdate]);

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

  // Força atualizações
  const forceUpdate = () => {
    setStorageUpdate(prev => prev + 1);
  };

  return {
    workflowStatuses,
    getStatusOptions,
    getStatusColor,
    getAllStatuses,
    forceUpdate
  };
};
