import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { detectClienteIdCorruptions } from '@/utils/fixClienteIdCorruption';
import { forceReinitialize } from '@/utils/initializeApp';
import { useAppContext } from '@/contexts/AppContext';
import { useUnifiedWorkflowData } from '@/hooks/useUnifiedWorkflowData';
import { RefreshCw, CheckCircle, AlertTriangle, XCircle } from 'lucide-react';

/**
 * Componente de debug para monitorar a saúde do sistema
 * Remover em produção ou deixar apenas para admins
 */
export function SystemStatus() {
  const { workflowItems, clientes } = useAppContext();
  const { unifiedWorkflowData } = useUnifiedWorkflowData();
  const [corruptions, setCorruptions] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Verificar status do sistema
  const checkSystemStatus = async () => {
    setIsLoading(true);
    try {
      const corruptionStatus = detectClienteIdCorruptions();
      setCorruptions(corruptionStatus);
    } catch (error) {
      console.error('Erro ao verificar status:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Verificar na inicialização
  useEffect(() => {
    checkSystemStatus();
  }, []);

  // Status da inicialização
  const initializationStatus = JSON.parse(localStorage.getItem('app_initialized') || 'null');
  const hasCorruptions = corruptions && (corruptions.workflowItemsCorrupted > 0 || corruptions.sessionsCorrupted > 0);

  const handleForceReinit = () => {
    if (confirm('Tem certeza que deseja forçar a reinicialização? Isso irá reexecutar todas as migrações.')) {
      forceReinitialize();
      window.location.reload();
    }
  };

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Status do Sistema
          <Button 
            variant="outline" 
            size="sm" 
            onClick={checkSystemStatus}
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Status de Inicialização */}
        <div className="flex items-center justify-between">
          <span>Inicialização do Sistema</span>
          {initializationStatus ? (
            <Badge variant={initializationStatus.success ? "default" : "destructive"}>
              <CheckCircle className="h-3 w-3 mr-1" />
              {initializationStatus.success ? 'Concluída' : 'Com Erros'}
            </Badge>
          ) : (
            <Badge variant="secondary">
              <AlertTriangle className="h-3 w-3 mr-1" />
              Pendente
            </Badge>
          )}
        </div>

        {/* Status de Corrupções */}
        <div className="flex items-center justify-between">
          <span>Integridade dos Dados</span>
          {hasCorruptions ? (
            <Badge variant="destructive">
              <XCircle className="h-3 w-3 mr-1" />
              {corruptions.workflowItemsCorrupted + corruptions.sessionsCorrupted} Corrupções
            </Badge>
          ) : (
            <Badge variant="default">
              <CheckCircle className="h-3 w-3 mr-1" />
              Íntegro
            </Badge>
          )}
        </div>

        {/* Estatísticas dos Dados */}
        <div className="grid grid-cols-2 gap-4 pt-4 border-t">
          <div>
            <p className="text-sm text-muted-foreground">Clientes</p>
            <p className="text-xl font-semibold">{clientes.length}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Workflow Items</p>
            <p className="text-xl font-semibold">{workflowItems.length}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Dados Unificados</p>
            <p className="text-xl font-semibold">{unifiedWorkflowData.length}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Performance Config</p>
            <p className="text-sm">
              {localStorage.getItem('performance_config') ? 
                <Badge variant="outline">Ativa</Badge> : 
                <Badge variant="secondary">Padrão</Badge>
              }
            </p>
          </div>
        </div>

        {/* Detalhes de Inicialização */}
        {initializationStatus && (
          <div className="pt-4 border-t">
            <h4 className="font-semibold mb-2">Detalhes da Inicialização</h4>
            <div className="text-sm space-y-1">
              <p><strong>Executada em:</strong> {new Date(initializationStatus.completedAt).toLocaleString()}</p>
              <p><strong>Migrações:</strong> {initializationStatus.migrationsRun?.length || 0}</p>
              {initializationStatus.migrationsRun?.length > 0 && (
                <ul className="ml-4 list-disc">
                  {initializationStatus.migrationsRun.map((migration: string) => (
                    <li key={migration}>{migration}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}

        {/* Ações de Manutenção */}
        <div className="pt-4 border-t">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleForceReinit}
            className="w-full"
          >
            Forçar Reinicialização
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}