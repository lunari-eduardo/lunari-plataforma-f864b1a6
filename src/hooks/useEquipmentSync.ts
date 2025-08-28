import { useEffect, useState } from 'react';
import { pricingFinancialIntegrationService } from '@/services/PricingFinancialIntegrationService';

export interface EquipmentCandidate {
  transacaoId: string;
  nome: string;
  valor: number;
  data: string;
  observacoes?: string;
}

// Eventos customizados para comunicação entre sistemas
export const EQUIPMENT_SYNC_EVENT = 'equipment-sync:candidate';
export const EQUIPMENT_CREATED_EVENT = 'equipment-sync:created';
export const EQUIPMENT_FORCE_SCAN_EVENT = 'equipment-sync:force-scan';

export function useEquipmentSync() {
  const [isMonitoring, setIsMonitoring] = useState(true);

  useEffect(() => {
    if (!isMonitoring) return;
    
    const checkForNewEquipment = () => {
      try {
        const novosEquipamentos = pricingFinancialIntegrationService.detectNewEquipmentTransactions();
        
        if (novosEquipamentos.length > 0) {
          console.log(`🔧 [EquipmentSync] ${novosEquipamentos.length} equipamentos detectados`);
          
          novosEquipamentos.forEach(({ transacao, valor, data, observacoes }) => {
            const nomeEquipamento = observacoes?.trim() || `Equipamento R$ ${valor.toFixed(2)}`;
            
            // Emitir evento para notificação manual (sem auto-criar)
            const candidate: EquipmentCandidate = {
              transacaoId: transacao.id,
              nome: nomeEquipamento,
              valor,
              data,
              observacoes
            };

            const event = new CustomEvent(EQUIPMENT_SYNC_EVENT, {
              detail: candidate
            });
            
            window.dispatchEvent(event);
            console.log('🔧 [EquipmentSync] Candidato a equipamento emitido para configuração manual:', candidate);
          });
        }
      } catch (error) {
        console.error('🔧 [EquipmentSync] Erro ao verificar equipamentos:', error);
      }
    };

    // Listener para force-scan (imediato após criação de transação)
    const handleForceScan = () => {
      console.log('🔧 [EquipmentSync] Force scan solicitado');
      checkForNewEquipment();
    };

    // Verificação inicial
    checkForNewEquipment();

    // Verificar a cada 10 segundos para detectar novas transações
    const interval = setInterval(checkForNewEquipment, 10000);
    
    // Listener para force-scan
    window.addEventListener(EQUIPMENT_FORCE_SCAN_EVENT, handleForceScan);

    return () => {
      clearInterval(interval);
      window.removeEventListener(EQUIPMENT_FORCE_SCAN_EVENT, handleForceScan);
    };
  }, [isMonitoring]);

  const startMonitoring = () => setIsMonitoring(true);
  const stopMonitoring = () => setIsMonitoring(false);

  return {
    isMonitoring,
    startMonitoring,
    stopMonitoring
  };
}