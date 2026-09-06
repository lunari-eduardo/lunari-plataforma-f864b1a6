import { useState, useEffect, useCallback } from 'react';
import { EQUIPMENT_SYNC_EVENT, EQUIPMENT_FORCE_SCAN_EVENT } from '@/hooks/useEquipmentSync';
import { pricingFinancialIntegrationService } from '@/services/PricingFinancialIntegrationService';

export interface EquipmentCandidate {
  nome: string;
  valor: number;
  data: string;
  allTransactionIds: string[];
}

export const useEquipmentScanner = () => {
  const [equipmentModalOpen, setEquipmentModalOpen] = useState(false);
  const [equipmentData, setEquipmentData] = useState<EquipmentCandidate | null>(null);
  const [cacheVersion, setCacheVersion] = useState(0);

  useEffect(() => {
    const handleEquipmentDetected = (event: CustomEvent) => {
      const candidate = event.detail;
      console.log('🔧 [Dashboard] Equipamento detectado:', candidate);

      setEquipmentData({
        nome: candidate.observacoes || candidate.nome,
        valor: candidate.valor,
        data: candidate.data,
        allTransactionIds: candidate.allTransactionIds || [candidate.transacaoId],
      });
      setEquipmentModalOpen(true);
    };

    const handleCacheUpdate = () => {
      console.log('📊 [Dashboard] Cache do workflow foi atualizado, recalculando...');
      setCacheVersion((prev) => prev + 1);
    };

    window.addEventListener(EQUIPMENT_SYNC_EVENT, handleEquipmentDetected as EventListener);
    window.addEventListener('workflowMetricsUpdated', handleCacheUpdate);
    window.addEventListener('workflowCacheRecalculated', handleCacheUpdate);

    return () => {
      window.removeEventListener(EQUIPMENT_SYNC_EVENT, handleEquipmentDetected as EventListener);
      window.removeEventListener('workflowMetricsUpdated', handleCacheUpdate);
      window.removeEventListener('workflowCacheRecalculated', handleCacheUpdate);
    };
  }, []);

  const handleEquipmentModalClose = useCallback(() => {
    if (equipmentData?.allTransactionIds) {
      pricingFinancialIntegrationService.markEquipmentTransactionsAsProcessed(
        equipmentData.allTransactionIds,
      );
    }
    setEquipmentModalOpen(false);
    setEquipmentData(null);
  }, [equipmentData]);

  const triggerEquipmentScan = useCallback(() => {
    const event = new CustomEvent(EQUIPMENT_FORCE_SCAN_EVENT);
    window.dispatchEvent(event);
  }, []);

  return {
    equipmentModalOpen,
    equipmentData,
    cacheVersion,
    handleEquipmentModalClose,
    triggerEquipmentScan,
  };
};
