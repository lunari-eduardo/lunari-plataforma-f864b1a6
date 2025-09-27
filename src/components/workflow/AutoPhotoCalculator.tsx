/**
 * Componente para cálculo automático de fotos extras
 * Integra com as regras congeladas e o banco de dados
 */

import React, { useCallback, useEffect, useRef } from 'react';
import { pricingFreezingService } from '@/services/PricingFreezingService';

interface AutoPhotoCalculatorProps {
  sessionId: string;
  quantidade: number;
  regrasCongeladas?: any;
  currentValorFotoExtra?: number;
  currentValorTotalFotoExtra?: number;
  categoria?: string;
  categoriaId?: string;
  valorFotoExtraPacote?: number;
  onValueUpdate: (updates: {
    valorFotoExtra: number;
    valorTotalFotoExtra: number;
  }) => void;
}

export const AutoPhotoCalculator: React.FC<AutoPhotoCalculatorProps> = ({
  sessionId,
  quantidade,
  regrasCongeladas,
  currentValorFotoExtra = 0,
  currentValorTotalFotoExtra = 0,
  categoria,
  categoriaId,
  valorFotoExtraPacote,
  onValueUpdate
}) => {
  const lastComputedRef = useRef<{
    quantidade: number;
    valorFotoExtra: number;
    valorTotalFotoExtra: number;
    regrasCongeladas?: any;
  } | null>(null);

  // Helper function to calculate and update values
  const calcularEAtualizarValores = useCallback(async () => {
    console.log('🧮 AutoPhotoCalculator: Starting calculation for session:', sessionId, 'quantidade:', quantidade);
    
    try {
      // If quantidade is 0 or null, reset values
      if (!quantidade || quantidade === 0) {
        console.log('🧮 AutoPhotoCalculator: Resetting values (quantidade is 0)');
        
        // Check if we need to reset
        if (currentValorFotoExtra !== 0 || currentValorTotalFotoExtra !== 0) {
          onValueUpdate({
            valorFotoExtra: 0,
            valorTotalFotoExtra: 0
          });
        }
        return;
      }

      let valorFotoExtra = 0;
      let valorTotalFotoExtra = 0;

      // If we have frozen rules, use them
      if (regrasCongeladas) {
        console.log('🧮 AutoPhotoCalculator: Using frozen rules:', regrasCongeladas);
        const resultado = pricingFreezingService.calcularValorFotoExtraComRegrasCongeladas(
          quantidade,
          regrasCongeladas
        );
        valorFotoExtra = resultado.valorUnitario;
        valorTotalFotoExtra = resultado.valorTotal;
      } else {
        console.log('🧮 AutoPhotoCalculator: Using dynamic pricing calculation', { categoria, categoriaId, valorFotoExtraPacote });
        // Import dynamically to avoid circular dependencies
        const { calcularTotalFotosExtras } = await import('@/utils/precificacaoUtils');
        
        // Build pacoteInfo with category information for categoria mode
        const pacoteInfo = {
          valorFotoExtra: valorFotoExtraPacote,
          categoria,
          categoriaId
        };
        
        const resultado = calcularTotalFotosExtras(quantidade, pacoteInfo);
        valorFotoExtra = quantidade > 0 ? resultado / quantidade : 0;
        valorTotalFotoExtra = resultado;
      }

      console.log('🧮 AutoPhotoCalculator: Calculated values:', {
        valorFotoExtra,
        valorTotalFotoExtra,
        currentValorFotoExtra,
        currentValorTotalFotoExtra
      });

      // Check if this is the same computation we just did
      const lastComputed = lastComputedRef.current;
      if (
        lastComputed &&
        lastComputed.quantidade === quantidade &&
        Math.abs(lastComputed.valorFotoExtra - valorFotoExtra) < 0.01 &&
        Math.abs(lastComputed.valorTotalFotoExtra - valorTotalFotoExtra) < 0.01 &&
        JSON.stringify(lastComputed.regrasCongeladas) === JSON.stringify(regrasCongeladas)
      ) {
        console.log('🧮 AutoPhotoCalculator: Same computation already done, skipping');
        return;
      }

      // Only update if values have changed from current props
      if (
        Math.abs(valorFotoExtra - currentValorFotoExtra) > 0.01 ||
        Math.abs(valorTotalFotoExtra - currentValorTotalFotoExtra) > 0.01
      ) {
        console.log('🧮 AutoPhotoCalculator: Values changed, updating...');
        
        // Store what we computed
        lastComputedRef.current = {
          quantidade,
          valorFotoExtra,
          valorTotalFotoExtra,
          regrasCongeladas
        };
        
        onValueUpdate({
          valorFotoExtra,
          valorTotalFotoExtra
        });
      } else {
        console.log('🧮 AutoPhotoCalculator: Values unchanged, skipping update');
      }
    } catch (error) {
      console.error('❌ AutoPhotoCalculator: Error calculating values:', error);
    }
  }, [sessionId, quantidade, regrasCongeladas, currentValorFotoExtra, currentValorTotalFotoExtra, categoria, categoriaId, valorFotoExtraPacote, onValueUpdate]);

  // Calculate whenever dependencies change
  useEffect(() => {
    calcularEAtualizarValores();
  }, [calcularEAtualizarValores]);

  return null;
};