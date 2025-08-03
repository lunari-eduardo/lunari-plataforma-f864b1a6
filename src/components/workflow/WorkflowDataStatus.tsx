import React from 'react';
import { Button } from '@/components/ui/button';
import { RefreshCw, AlertCircle } from 'lucide-react';
import { useAppContext } from '@/contexts/AppContext';
import { useUnifiedWorkflowData } from '@/hooks/useUnifiedWorkflowData';

export function WorkflowDataStatus() {
  const { refreshWorkflowData, isPreviewMode } = useAppContext();
  const { unifiedWorkflowData, workflowSessions } = useUnifiedWorkflowData();

  const totalItems = unifiedWorkflowData.length;
  const sessionsLoaded = workflowSessions.length;

  const handleRefresh = () => {
    refreshWorkflowData();
    // Also trigger a storage event to force reload
    window.dispatchEvent(new StorageEvent('storage', {
      key: 'workflow_sessions',
      newValue: localStorage.getItem('workflow_sessions')
    }));
  };

  return (
    <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg border">
      {isPreviewMode && (
        <div className="flex items-center gap-2 text-yellow-600">
          <AlertCircle className="h-4 w-4" />
          <span className="text-sm">Modo Preview</span>
        </div>
      )}
      
      <div className="flex items-center gap-4 text-sm text-muted-foreground">
        <span>Items: {totalItems}</span>
        <span>Sessões: {sessionsLoaded}</span>
      </div>
      
      <Button
        variant="outline"
        size="sm"
        onClick={handleRefresh}
        className="ml-auto"
      >
        <RefreshCw className="h-4 w-4 mr-2" />
        Atualizar Dados
      </Button>
    </div>
  );
}