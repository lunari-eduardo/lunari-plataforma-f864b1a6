import { useState, useEffect, useCallback } from 'react';
import { pricingFinancialIntegrationService } from '@/services/PricingFinancialIntegrationService';
import { POLLING_INTERVAL } from '@/constants/financialConstants';

export function usePricingSync() {
  const [custosDisponiveis, setCustosDisponiveis] = useState(0);
  const [syncModalOpen, setSyncModalOpen] = useState(false);

  // Otimized polling with proper cleanup
  useEffect(() => {
    const checkAvailableCosts = () => {
      const custos = pricingFinancialIntegrationService.getCustosEstudioFromPricingForSync();
      setCustosDisponiveis(custos.length);
      console.log(`🔄 Custos disponíveis na precificação: ${custos.length}`);
    };

    checkAvailableCosts();
    const interval = setInterval(checkAvailableCosts, POLLING_INTERVAL);
    
    return () => clearInterval(interval);
  }, []);

  const handleSyncComplete = useCallback(() => {
    // Force immediate update of available costs
    const custos = pricingFinancialIntegrationService.getCustosEstudioFromPricingForSync();
    setCustosDisponiveis(custos.length);
    console.log(`✅ Sincronização concluída. Custos atualizados: ${custos.length}`);
  }, []);

  return {
    custosDisponiveis,
    syncModalOpen,
    setSyncModalOpen,
    handleSyncComplete
  };
}