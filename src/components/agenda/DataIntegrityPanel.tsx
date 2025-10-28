import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { AlertTriangle, CheckCircle, RefreshCw, Settings, ChevronDown, ChevronRight } from 'lucide-react';
import { useDataIntegrityCheck } from '@/hooks/useDataIntegrityCheck';
import { toast } from 'sonner';
export function DataIntegrityPanel() {
  const {
    issues,
    isChecking,
    isRepairing,
    runIntegrityCheck,
    repairAllIssues,
    hasIssues
  } = useDataIntegrityCheck();
  const [isExpanded, setIsExpanded] = useState(false);
  const handleRepair = async () => {
    try {
      const repairedCount = await repairAllIssues();
      toast.success(`${repairedCount} problemas corrigidos automaticamente`);
    } catch (error) {
      toast.error('Erro ao corrigir problemas');
      console.error('Repair error:', error);
    }
  };
  const getIssueIcon = (type: string) => {
    switch (type) {
      case 'confirmed_without_session':
        return '📅';
      case 'orphaned_session':
        return '🔗';
      case 'mismatched_session_id':
        return '⚠️';
      default:
        return '❓';
    }
  };
  const getIssueTypeLabel = (type: string) => {
    switch (type) {
      case 'confirmed_without_session':
        return 'Agendamento sem sessão';
      case 'orphaned_session':
        return 'Sessão órfã';
      case 'mismatched_session_id':
        return 'IDs não correspondentes';
      default:
        return 'Problema desconhecido';
    }
  };
  return <Card className="w-full border-lunar-border bg-lunar-surface">
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <CollapsibleTrigger asChild>
          
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-lunar-textSecondary">
                Verificação automática da sincronização entre agenda e workflow
              </p>
              <Button variant="outline" size="sm" onClick={runIntegrityCheck} disabled={isChecking} className="flex items-center gap-2">
                <RefreshCw className={`h-4 w-4 ${isChecking ? 'animate-spin' : ''}`} />
                {isChecking ? 'Verificando...' : 'Verificar'}
              </Button>
            </div>

            {hasIssues && <div className="space-y-4">
                <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-medium text-lunar-text">
                      Problemas Detectados
                    </h4>
                    <Button variant="destructive" size="sm" onClick={handleRepair} disabled={isRepairing} className="flex items-center gap-2">
                      {isRepairing ? <>
                          <RefreshCw className="h-4 w-4 animate-spin" />
                          Corrigindo...
                        </> : <>
                          <Settings className="h-4 w-4" />
                          Corrigir Automaticamente
                        </>}
                    </Button>
                  </div>

                  <div className="space-y-2">
                    {issues.map((issue, index) => <div key={index} className="flex items-start gap-3 p-3 bg-lunar-surface rounded border border-lunar-border">
                        <span className="text-lg">{getIssueIcon(issue.type)}</span>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant="outline" className="text-xs">
                              {getIssueTypeLabel(issue.type)}
                            </Badge>
                            {issue.appointmentId && <Badge variant="secondary" className="text-xs">
                                Agendamento: {issue.appointmentId.slice(-8)}
                              </Badge>}
                            {issue.sessionId && <Badge variant="secondary" className="text-xs">
                                Sessão: {issue.sessionId.slice(-8)}
                              </Badge>}
                          </div>
                          <p className="text-sm text-lunar-text">{issue.description}</p>
                        </div>
                      </div>)}
                  </div>
                </div>
              </div>}

            {!hasIssues && !isChecking && <div className="bg-lunar-success/10 border border-lunar-success/20 rounded-lg p-4">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-lunar-success" />
                  <p className="text-sm font-medium text-lunar-success">
                    Todos os dados estão sincronizados corretamente
                  </p>
                </div>
                <p className="text-xs text-lunar-textSecondary mt-1">
                  Nenhum problema de integridade foi encontrado entre a agenda e o workflow.
                </p>
              </div>}

            <div className="text-xs text-lunar-textSecondary space-y-1">
              <p><strong>Verificações realizadas:</strong></p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>Agendamentos confirmados sem sessões no workflow</li>
                <li>Sessões do workflow com referências quebradas</li>
                <li>IDs de sessão não correspondentes</li>
              </ul>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>;
}