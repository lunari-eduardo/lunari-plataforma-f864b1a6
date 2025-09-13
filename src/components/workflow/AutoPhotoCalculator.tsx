/**
 * Componente para cálculo automático de fotos extras
 * Integra com as regras congeladas e o banco de dados
 */

import React, { useCallback, useEffect } from 'react';
import { pricingFreezingService } from '@/services/PricingFreezingService';

interface AutoPhotoCalculatorProps {
  sessionId: string;
  quantidade: number;
  regrasCongeladas?: any;
  currentValorFotoExtra?: string;
  currentValorTotalFotoExtra?: string;
  onValueUpdate: (sessionId: string, field: string, value: any) => void;
}

export function AutoPhotoCalculator({ 
  sessionId, 
  quantidade, 
  regrasCongeladas,
  currentValorFotoExtra,
  currentValorTotalFotoExtra,
  onValueUpdate 
}: AutoPhotoCalculatorProps) {
  
  const calcularEAtualizarValores = useCallback(async () => {
    console.log('🧮 AutoPhotoCalculator: Starting calculation for session', sessionId, 'qty:', quantidade);
    
    const zeroValueString = 'R$ 0,00';
    
    if (!quantidade || quantidade <= 0) {
      console.log('🧮 Zero quantity, clearing values if needed');
      // Only update if values actually need to change
      if (currentValorFotoExtra !== zeroValueString) {
        onValueUpdate(sessionId, 'valorFotoExtra', zeroValueString);
      }
      if (currentValorTotalFotoExtra !== zeroValueString) {
        onValueUpdate(sessionId, 'valorTotalFotoExtra', zeroValueString);
      }
      return;
    }

    try {
      if (regrasCongeladas) {
        console.log('🧮 Using frozen rules for calculation:', regrasCongeladas);
        // Usar regras congeladas
        const resultado = pricingFreezingService.calcularValorFotoExtraComRegrasCongeladas(
          quantidade, 
          regrasCongeladas
        );
        
        const newValorUnitario = `R$ ${resultado.valorUnitario.toFixed(2).replace('.', ',')}`;
        const newValorTotal = `R$ ${resultado.valorTotal.toFixed(2).replace('.', ',')}`;
        
        // Only update if values actually changed
        if (currentValorFotoExtra !== newValorUnitario) {
          onValueUpdate(sessionId, 'valorFotoExtra', newValorUnitario);
        }
        if (currentValorTotalFotoExtra !== newValorTotal) {
          onValueUpdate(sessionId, 'valorTotalFotoExtra', newValorTotal);
        }
        
        console.log('📸 Cálculo com regras congeladas:', {
          sessionId,
          quantidade,
          valorUnitario: resultado.valorUnitario,
          valorTotal: resultado.valorTotal,
          changed: currentValorFotoExtra !== newValorUnitario || currentValorTotalFotoExtra !== newValorTotal
        });
      } else {
        console.log('🧮 Using current pricing rules');
        // Usar regras atuais (para sessões sem congelamento)
        const { calcularTotalFotosExtras } = await import('@/utils/precificacaoUtils');
        
        const valorTotal = calcularTotalFotosExtras(quantidade, {});
        const valorUnitario = quantidade > 0 ? valorTotal / quantidade : 0;
        
        const newValorUnitario = `R$ ${valorUnitario.toFixed(2).replace('.', ',')}`;
        const newValorTotal = `R$ ${valorTotal.toFixed(2).replace('.', ',')}`;
        
        // Only update if values actually changed
        if (currentValorFotoExtra !== newValorUnitario) {
          onValueUpdate(sessionId, 'valorFotoExtra', newValorUnitario);
        }
        if (currentValorTotalFotoExtra !== newValorTotal) {
          onValueUpdate(sessionId, 'valorTotalFotoExtra', newValorTotal);
        }
        
        console.log('📸 Cálculo com regras atuais:', {
          sessionId,
          quantidade,
          valorUnitario,
          valorTotal,
          changed: currentValorFotoExtra !== newValorUnitario || currentValorTotalFotoExtra !== newValorTotal
        });
      }
    } catch (error) {
      console.error('❌ Erro no cálculo automático de fotos extras:', error);
    }
  }, [sessionId, quantidade, regrasCongeladas, currentValorFotoExtra, currentValorTotalFotoExtra, onValueUpdate]);

  // Executar cálculo quando quantidade mudar
  useEffect(() => {
    calcularEAtualizarValores();
  }, [calcularEAtualizarValores]);

  // Componente não renderiza nada, apenas executa lógica
  return null;
}