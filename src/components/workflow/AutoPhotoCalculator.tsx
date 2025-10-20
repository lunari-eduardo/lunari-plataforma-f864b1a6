/**
 * Componente para cálculo automático de fotos extras
 * Integra com as regras congeladas e o banco de dados
 */

import React, { useCallback, useEffect, useRef, useMemo } from 'react';
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

  // CORREÇÃO: Armazenar onValueUpdate em ref para evitar dependências instáveis
  const onValueUpdateRef = useRef(onValueUpdate);
  useEffect(() => {
    onValueUpdateRef.current = onValueUpdate;
  }, [onValueUpdate]);

  // Helper function to calculate and update values
  const calcularEAtualizarValores = useCallback(async () => {
    
    try {
      // CORREÇÃO: Early return reforçado para quantidade 0
      if (!quantidade || quantidade === 0) {
        // Verificar se já computamos isso
        const lastComputed = lastComputedRef.current;
        if (lastComputed && lastComputed.quantidade === 0 && 
            currentValorFotoExtra === 0 && currentValorTotalFotoExtra === 0) {
          return; // Já está zerado, não precisa fazer nada
        }
        
        // Resetar apenas se necessário
        if (currentValorFotoExtra !== 0 || currentValorTotalFotoExtra !== 0) {
          lastComputedRef.current = { quantidade: 0, valorFotoExtra: 0, valorTotalFotoExtra: 0 };
          onValueUpdateRef.current({
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
        const resultado = pricingFreezingService.calcularValorFotoExtraComRegrasCongeladas(
          quantidade,
          regrasCongeladas
        );
        valorFotoExtra = resultado.valorUnitario;
        valorTotalFotoExtra = resultado.valorTotal;
      } else {
        const { calcularTotalFotosExtras } = await import('@/utils/precificacaoUtils');
        const pacoteInfo = {
          valorFotoExtra: valorFotoExtraPacote,
          categoria,
          categoriaId
        };
        const resultado = calcularTotalFotosExtras(quantidade, pacoteInfo);
        valorFotoExtra = quantidade > 0 ? resultado / quantidade : 0;
        valorTotalFotoExtra = resultado;
      }

      // Check if this is the same computation we just did
      const lastComputed = lastComputedRef.current;
      if (
        lastComputed &&
        lastComputed.quantidade === quantidade &&
        Math.abs(lastComputed.valorFotoExtra - valorFotoExtra) < 0.01 &&
        Math.abs(lastComputed.valorTotalFotoExtra - valorTotalFotoExtra) < 0.01 &&
        JSON.stringify(lastComputed.regrasCongeladas) === JSON.stringify(regrasCongeladas)
      ) {
        return;
      }

      // Only update if values have changed from current props
      if (
        Math.abs(valorFotoExtra - currentValorFotoExtra) > 0.01 ||
        Math.abs(valorTotalFotoExtra - currentValorTotalFotoExtra) > 0.01
      ) {
        // Store what we computed
        lastComputedRef.current = {
          quantidade,
          valorFotoExtra,
          valorTotalFotoExtra,
          regrasCongeladas
        };
        
        // CORREÇÃO: Usar ref para evitar dependência instável
        onValueUpdateRef.current({
          valorFotoExtra,
          valorTotalFotoExtra
        });
      }
    } catch (error) {
      console.error('❌ AutoPhotoCalculator: Error calculating values:', error);
    }
  }, [sessionId, quantidade, regrasCongeladas, currentValorFotoExtra, currentValorTotalFotoExtra, categoria, categoriaId, valorFotoExtraPacote]);

  // Calculate whenever dependencies change
  useEffect(() => {
    calcularEAtualizarValores();
  }, [calcularEAtualizarValores]);

  return null;
};