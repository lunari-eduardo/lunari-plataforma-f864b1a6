import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { CheckCircle, AlertCircle, DollarSign, TrendingUp, RefreshCw } from 'lucide-react';
import { useDepreciationSync } from '@/hooks/useDepreciationSync';

export function DepreciationSyncNotification() {
  const { syncStatus, isSyncing, syncDepreciation, getDepreciationData } = useDepreciationSync();
  const [showDetails, setShowDetails] = useState(false);
  const [depreciationData, setDepreciationData] = useState<any>(null);

  useEffect(() => {
    const data = getDepreciationData();
    setDepreciationData(data);
  }, [syncStatus]);

  // Não mostrar se não há equipamentos
  if (!depreciationData || !depreciationData.equipamentos || depreciationData.equipamentos.length === 0 || depreciationData.totalMensal <= 0) {
    return null;
  }

  const handleSync = async () => {
    await syncDepreciation();
  };

  const getSyncStatusColor = () => {
    if (!syncStatus) return 'secondary';
    return syncStatus.synced ? 'default' : 'destructive';
  };

  const getSyncStatusText = () => {
    if (!syncStatus) return 'Verificando...';
    return syncStatus.synced ? 'Sincronizado' : 'Dessincronizado';
  };

  return (
    <Card className="border-l-4 border-l-primary/50 bg-gradient-to-r from-primary/5 to-transparent">
      <CardContent className="pt-4">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              <h4 className="font-medium text-sm">Depreciação de Equipamentos</h4>
              <Badge variant={getSyncStatusColor()} className="text-xs">
                {getSyncStatusText()}
              </Badge>
            </div>
            
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <DollarSign className="h-3 w-3" />
                <span>R$ {depreciationData.totalMensal.toFixed(2)}/mês</span>
              </div>
              <div className="flex items-center gap-1">
                <span>{(depreciationData.equipamentos || []).length} equipamentos</span>
              </div>
            </div>

            {syncStatus && !syncStatus.synced && (
              <div className="flex items-center gap-1 text-xs text-orange-600">
                <AlertCircle className="h-3 w-3" />
                <span>Diferença: R$ {syncStatus.diferenca.toFixed(2)}</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowDetails(!showDetails)}
              className="text-xs h-8"
            >
              {showDetails ? 'Ocultar' : 'Detalhes'}
            </Button>
            
            <Button
              size="sm"
              onClick={handleSync}
              disabled={isSyncing || (syncStatus?.synced || false)}
              className="text-xs h-8"
            >
              {isSyncing ? (
                <>
                  <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                  Sincronizando...
                </>
              ) : syncStatus?.synced ? (
                <>
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Sincronizado
                </>
              ) : (
                <>
                  <RefreshCw className="h-3 w-3 mr-1" />
                  Sincronizar
                </>
              )}
            </Button>
          </div>
        </div>

        {showDetails && (
          <>
            <Separator className="my-3" />
            <div className="space-y-2">
              <h5 className="font-medium text-xs text-muted-foreground">Equipamentos:</h5>
              <div className="grid gap-2 max-h-32 overflow-y-auto">
                {(depreciationData.equipamentos || []).map((eq: any) => (
                  <div key={eq.id} className="flex justify-between items-center text-xs">
                    <span className="flex-1 truncate">{eq.nome}</span>
                    <span className="text-muted-foreground">
                      R$ {eq.depreciacaoMensal.toFixed(2)}/mês
                    </span>
                  </div>
                ))}
              </div>
              
              {syncStatus && (
                <div className="mt-3 pt-2 border-t text-xs space-y-1">
                  <div className="flex justify-between">
                    <span>Valor na Precificação:</span>
                    <span className="font-medium">R$ {syncStatus.valorPrecificacao.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Valor no Financeiro:</span>
                    <span className="font-medium">R$ {syncStatus.valorFinanceiro.toFixed(2)}</span>
                  </div>
                  {!syncStatus.synced && (
                    <div className="flex justify-between text-orange-600">
                      <span>Diferença:</span>
                      <span className="font-medium">R$ {syncStatus.diferenca.toFixed(2)}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}