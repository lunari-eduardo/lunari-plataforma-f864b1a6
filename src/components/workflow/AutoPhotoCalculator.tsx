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
  onValueUpdate: (sessionId: string, field: string, value: any) => void;
}

export function AutoPhotoCalculator({ 
  sessionId, 
  quantidade, 
  regrasCongeladas,
  onValueUpdate 
}: AutoPhotoCalculatorProps) {
  
  const calcularEAtualizarValores = useCallback(async () => {
    if (!quantidade || quantidade <= 0) {
      // Se quantidade for 0, zerar valores
      onValueUpdate(sessionId, 'valorFotoExtra', 'R$ 0,00');
      onValueUpdate(sessionId, 'valorTotalFotoExtra', 'R$ 0,00');
      return;
    }

    try {
      if (regrasCongeladas) {
        // Usar regras congeladas
        const resultado = pricingFreezingService.calcularValorFotoExtraComRegrasCongeladas(
          quantidade, 
          regrasCongeladas
        );
        
        // Atualizar valor unitário e total
        onValueUpdate(sessionId, 'valorFotoExtra', `R$ ${resultado.valorUnitario.toFixed(2).replace('.', ',')}`);
        onValueUpdate(sessionId, 'valorTotalFotoExtra', `R$ ${resultado.valorTotal.toFixed(2).replace('.', ',')}`);
        
        console.log('📸 Cálculo com regras congeladas:', {
          quantidade,
          valorUnitario: resultado.valorUnitario,
          valorTotal: resultado.valorTotal,
          regras: regrasCongeladas
        });
      } else {
        // Usar regras atuais (para sessões sem congelamento)
        const { calcularTotalFotosExtras } = await import('@/utils/precificacaoUtils');
        
        const valorTotal = calcularTotalFotosExtras(quantidade, {});
        const valorUnitario = quantidade > 0 ? valorTotal / quantidade : 0;
        
        onValueUpdate(sessionId, 'valorFotoExtra', `R$ ${valorUnitario.toFixed(2).replace('.', ',')}`);
        onValueUpdate(sessionId, 'valorTotalFotoExtra', `R$ ${valorTotal.toFixed(2).replace('.', ',')}`);
        
        console.log('📸 Cálculo com regras atuais:', {
          quantidade,
          valorUnitario,
          valorTotal
        });
      }
    } catch (error) {
      console.error('❌ Erro no cálculo automático de fotos extras:', error);
    }
  }, [sessionId, quantidade, regrasCongeladas, onValueUpdate]);

  // Executar cálculo quando quantidade mudar
  useEffect(() => {
    calcularEAtualizarValores();
  }, [calcularEAtualizarValores]);

  // Componente não renderiza nada, apenas executa lógica
  return null;
}