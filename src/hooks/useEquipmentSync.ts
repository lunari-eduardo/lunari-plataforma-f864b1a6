import { useEffect, useState } from 'react';
import { pricingFinancialIntegrationService } from '@/services/PricingFinancialIntegrationService';

export interface EquipmentCandidate {
  transacaoId: string;
  nome: string;
  valor: number;
  data: string;
  observacoes?: string;
}

// Evento customizado para comunicação entre sistemas
export const EQUIPMENT_SYNC_EVENT = 'equipment-sync:candidate';

export function useEquipmentSync() {
  const [isMonitoring, setIsMonitoring] = useState(true);

  useEffect(() => {
    if (!isMonitoring) return;

    let lastCheckTime = Date.now();
    
    const checkForNewEquipment = () => {
      try {
        const novosEquipamentos = pricingFinancialIntegrationService.detectNewEquipmentTransactions();
        
        if (novosEquipamentos.length > 0) {
          console.log(`🔧 [EquipmentSync] ${novosEquipamentos.length} equipamentos detectados`);
          
          novosEquipamentos.forEach(({ transacao, valor, data, observacoes }) => {
            const candidate: EquipmentCandidate = {
              transacaoId: transacao.id,
              nome: observacoes || `Equipamento R$ ${valor.toFixed(2)}`,
              valor,
              data,
              observacoes
            };

            // Disparar evento customizado
            const event = new CustomEvent(EQUIPMENT_SYNC_EVENT, {
              detail: candidate
            });
            
            window.dispatchEvent(event);
            console.log('🔧 [EquipmentSync] Evento disparado:', candidate);
          });
        }
        
        lastCheckTime = Date.now();
      } catch (error) {
        console.error('🔧 [EquipmentSync] Erro ao verificar equipamentos:', error);
      }
    };

    // Verificação inicial
    checkForNewEquipment();

    // Verificar a cada 3 segundos para detectar novas transações
    const interval = setInterval(checkForNewEquipment, 3000);

    return () => {
      clearInterval(interval);
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