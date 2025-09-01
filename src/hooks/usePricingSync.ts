/**
 * HOOK DE SINCRONIZAÇÃO COM PRECIFICAÇÃO
 * 
 * Gerencia a sincronização entre precificação e sistema financeiro
 * com polling otimizado e cache
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { pricingFinancialIntegrationService } from '@/services/PricingFinancialIntegrationService';
import { CONFIG } from '@/constants/financialConstants';

export function usePricingSync() {
  const [custosDisponiveis, setCustosDisponiveis] = useState(0);
  const [isPolling, setIsPolling] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const cacheRef = useRef<{ custos: number; timestamp: number }>({ custos: 0, timestamp: 0 });

  // ============= VERIFICAÇÃO DE CUSTOS COM CACHE =============
  
  const verificarCustosDisponiveis = useCallback(() => {
    try {
      const now = Date.now();
      const CACHE_DURATION = 1000; // 1 segundo de cache
      
      // Usar cache se ainda válido
      if (now - cacheRef.current.timestamp < CACHE_DURATION) {
        return cacheRef.current.custos;
      }

      const custos = pricingFinancialIntegrationService.getCustosEstudioFromPricingForSync();
      const quantidade = custos.length;
      
      // Atualizar cache
      cacheRef.current = { custos: quantidade, timestamp: now };
      setCustosDisponiveis(quantidade);
      
      console.log(`🔄 Custos disponíveis na precificação: ${quantidade}`);
      return quantidade;
    } catch (error) {
      console.error('Erro ao verificar custos disponíveis:', error);
      return 0;
    }
  }, []);

  // ============= CONTROLE DE POLLING =============
  
  const iniciarPolling = useCallback(() => {
    if (isPolling) return;
    
    setIsPolling(true);
    
    // Verificação inicial
    verificarCustosDisponiveis();
    
    // Configurar intervalo
    intervalRef.current = setInterval(verificarCustosDisponiveis, CONFIG.POLLING_INTERVAL);
    
    console.log('📊 Polling de custos iniciado');
  }, [isPolling, verificarCustosDisponiveis]);

  const pararPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsPolling(false);
    console.log('⏹️ Polling de custos parado');
  }, []);

  // ============= FORÇAR ATUALIZAÇÃO =============
  
  const forcarAtualizacao = useCallback(() => {
    // Limpar cache para forçar nova verificação
    cacheRef.current = { custos: 0, timestamp: 0 };
    return verificarCustosDisponiveis();
  }, [verificarCustosDisponiveis]);

  // ============= LIFECYCLE =============
  
  useEffect(() => {
    iniciarPolling();
    
    return () => {
      pararPolling();
    };
  }, [iniciarPolling, pararPolling]);

  // Limpar intervalo quando componente desmonta
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  // ============= RETORNO =============
  
  return {
    custosDisponiveis,
    isPolling,
    verificarCustosDisponiveis,
    forcarAtualizacao,
    iniciarPolling,
    pararPolling
  };
}