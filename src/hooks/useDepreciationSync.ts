import { useEffect, useState } from 'react';
import { pricingFinancialIntegrationService } from '@/services/PricingFinancialIntegrationService';
import { useToast } from '@/hooks/use-toast';

export interface DepreciationSyncStatus {
  synced: boolean;
  valorPrecificacao: number;
  valorFinanceiro: number;
  diferenca: number;
  itemFinanceiroId?: string;
}

export function useDepreciationSync() {
  const { toast } = useToast();
  const [syncStatus, setSyncStatus] = useState<DepreciationSyncStatus | null>(null);
  const [isMonitoring, setIsMonitoring] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);

  // Monitorar mudanças na depreciação
  useEffect(() => {
    if (!isMonitoring) return;

    const checkDepreciationStatus = () => {
      try {
        const status = pricingFinancialIntegrationService.isDepreciationSynced();
        setSyncStatus(status);
        
        // Log para debug
        console.log('🔄 [DepreciationSync] Status:', status);
      } catch (error) {
        console.error('Erro ao verificar status da depreciação:', error);
      }
    };

    // Verificação inicial
    checkDepreciationStatus();

    // Verificar a cada 5 segundos para detectar mudanças
    const interval = setInterval(checkDepreciationStatus, 5000);

    return () => {
      clearInterval(interval);
    };
  }, [isMonitoring]);

  const syncDepreciation = async (): Promise<{
    success: boolean;
    error?: string;
  }> => {
    if (isSyncing) return { success: false, error: 'Sincronização já em andamento' };

    setIsSyncing(true);
    
    try {
      const result = pricingFinancialIntegrationService.syncDepreciationToFinancial();
      
      if (result.success) {
        // Atualizar status
        const newStatus = pricingFinancialIntegrationService.isDepreciationSynced();
        setSyncStatus(newStatus);

        toast({
          title: "Depreciação sincronizada",
          description: `Valor mensal de R$ ${result.valorDepreciacao.toFixed(2)} foi sincronizado com o financeiro.`,
        });

        // Disparar evento customizado para notificar outros componentes
        const event = new CustomEvent('depreciation-synced', {
          detail: { 
            valor: result.valorDepreciacao,
            itemFinanceiroId: result.itemFinanceiroId 
          }
        });
        window.dispatchEvent(event);

        console.log('🔄 [DepreciationSync] Sincronização realizada:', result);
        
        return { success: true };
      } else {
        toast({
          title: "Erro na sincronização",
          description: result.error || "Falha ao sincronizar depreciação.",
          variant: "destructive"
        });
        
        return { success: false, error: result.error };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      
      toast({
        title: "Erro na sincronização",
        description: errorMessage,
        variant: "destructive"
      });
      
      return { success: false, error: errorMessage };
    } finally {
      setIsSyncing(false);
    }
  };

  const getDepreciationData = () => {
    return pricingFinancialIntegrationService.getEquipmentDepreciation();
  };

  const startMonitoring = () => setIsMonitoring(true);
  const stopMonitoring = () => setIsMonitoring(false);

  return {
    syncStatus,
    isMonitoring,
    isSyncing,
    syncDepreciation,
    getDepreciationData,
    startMonitoring,
    stopMonitoring
  };
}