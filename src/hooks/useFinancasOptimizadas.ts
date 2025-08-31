import { useMemo, useState, useCallback } from 'react';
import { useNovoFinancas } from '@/hooks/useNovoFinancas';
import { FinancialEngine } from '@/services/FinancialEngine';

/**
 * Hook otimizado para operações financeiras frequentes
 * Implementa cache inteligente e operações em lote
 */
export function useFinancasOptimizadas() {
  const { itensFinanceiros, transacoes, createTransactionEngine } = useNovoFinancas();
  
  // Cache de operações custosas
  const [cache, setCache] = useState<Map<string, any>>(new Map());
  
  // Operações em lote para evitar múltiplas chamadas ao localStorage
  const [operacoesPendentes, setOperacoesPendentes] = useState<any[]>([]);
  
  // Debounce para operações de storage
  const processarOperacoesPendentes = useCallback(() => {
    if (operacoesPendentes.length === 0) return;
    
    // Processar todas as operações de uma vez
    operacoesPendentes.forEach(operacao => {
      createTransactionEngine(operacao);
    });
    
    setOperacoesPendentes([]);
  }, [operacoesPendentes, createTransactionEngine]);
  
  // Agendar processamento com debounce
  const adicionarOperacao = useCallback((operacao: any) => {
    setOperacoesPendentes(prev => [...prev, operacao]);
    
    const timer = setTimeout(processarOperacoesPendentes, 500);
    return () => clearTimeout(timer);
  }, [processarOperacoesPendentes]);
  
  // Maps otimizados para lookups O(1)
  const dadosOtimizados = useMemo(() => {
    const cacheKey = `dados_${transacoes.length}_${itensFinanceiros.length}`;
    
    if (cache.has(cacheKey)) {
      return cache.get(cacheKey);
    }
    
    const itensMap = new Map(itensFinanceiros.map(item => [item.id, item]));
    const transacoesPorItem = new Map<string, any[]>();
    const transacoesPorMes = new Map<string, any[]>();
    
    transacoes.forEach(transacao => {
      // Agrupar por item
      const itemTransacoes = transacoesPorItem.get(transacao.itemId) || [];
      itemTransacoes.push(transacao);
      transacoesPorItem.set(transacao.itemId, itemTransacoes);
      
      // Agrupar por mês
      const mesChave = transacao.dataVencimento?.substring(0, 7) || '';
      const mesTransacoes = transacoesPorMes.get(mesChave) || [];
      mesTransacoes.push(transacao);
      transacoesPorMes.set(mesChave, mesTransacoes);
    });
    
    const resultado = {
      itensMap,
      transacoesPorItem,
      transacoesPorMes
    };
    
    // Atualizar cache
    setCache(prev => {
      const novoCache = new Map(prev);
      novoCache.set(cacheKey, resultado);
      // Limitar tamanho do cache
      if (novoCache.size > 10) {
        const primeiraChave = novoCache.keys().next().value;
        novoCache.delete(primeiraChave);
      }
      return novoCache;
    });
    
    return resultado;
  }, [transacoes, itensFinanceiros, cache]);
  
  return {
    dadosOtimizados,
    adicionarOperacao,
    operacoesPendentes: operacoesPendentes.length
  };
}