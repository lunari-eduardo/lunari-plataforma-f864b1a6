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
            // Auto-criar equipamento na precificação com 5 anos de vida útil
            try {
              const novoEquipamento = pricingFinancialIntegrationService.createEquipmentFromTransaction({
                transacaoId: transacao.id,
                nome: observacoes || `Equipamento R$ ${valor.toFixed(2)}`,
                valor,
                data,
                observacoes,
                vidaUtil: 5 // 5 anos padrão
              });

              console.log('🔧 [EquipmentSync] Equipamento criado automaticamente:', novoEquipamento);

              // Marcar transação como processada
              pricingFinancialIntegrationService.markTransactionAsProcessed(transacao.id);

              // Disparar evento de equipamento criado
              const createdEvent = new CustomEvent(EQUIPMENT_CREATED_EVENT, {
                detail: {
                  equipment: novoEquipamento,
                  transaction: transacao
                }
              });
              
              window.dispatchEvent(createdEvent);
              console.log('🔧 [EquipmentSync] Evento de criação disparado:', novoEquipamento);

            } catch (error) {
              console.error('🔧 [EquipmentSync] Erro ao criar equipamento:', error);
              
              // Em caso de erro, disparar evento de candidato para revisão manual
              const candidate: EquipmentCandidate = {
                transacaoId: transacao.id,
                nome: observacoes || `Equipamento R$ ${valor.toFixed(2)}`,
                valor,
                data,
                observacoes
              };

              const candidateEvent = new CustomEvent(EQUIPMENT_SYNC_EVENT, {
                detail: candidate
              });
              
              window.dispatchEvent(candidateEvent);
              console.log('🔧 [EquipmentSync] Evento de candidato disparado por erro:', candidate);
            }
          });
        }
      } catch (error) {
        console.error('🔧 [EquipmentSync] Erro ao verificar equipamentos:', error);
      }
    };

    // Verificação inicial
    checkForNewEquipment();

    // Verificar a cada 5 segundos para detectar novas transações
    const interval = setInterval(checkForNewEquipment, 5000);

    // Listener para força de verificação imediata
    const handleForceScan = () => {
      console.log('🔧 [EquipmentSync] Força de verificação disparada');
      checkForNewEquipment();
    };

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