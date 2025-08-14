import { useState, useEffect, useCallback } from 'react';
import { storage, STORAGE_KEYS } from '@/utils/localStorage';

// Interface para as métricas mensais do workflow
interface WorkflowMonthlyMetrics {
  [key: string]: { // formato: "2024-08"
    receita: number;      // Valor pago (valorPago)
    previsto: number;     // Total calculado dinamicamente
    aReceber: number;     // Restante calculado dinamicamente  
    sessoes: number;      // Quantidade de sessões
    lastUpdated: string;  // Para invalidação
  }
}

// Cache key para métricas mensais
const WORKFLOW_METRICS_CACHE = 'lunari_workflow_monthly_metrics';

export function useWorkflowMetrics() {
  const [metricsCache, setMetricsCache] = useState<WorkflowMonthlyMetrics>(() => {
    return storage.load(WORKFLOW_METRICS_CACHE, {});
  });

  // Função para salvar métricas de um mês específico
  const saveMonthlyMetrics = useCallback((
    year: number,
    month: number,
    metrics: {
      receita: number;
      previsto: number;
      aReceber: number;
      sessoes: number;
    }
  ) => {
    const key = `${year}-${String(month).padStart(2, '0')}`;
    const newMetrics = {
      ...metricsCache,
      [key]: {
        ...metrics,
        lastUpdated: new Date().toISOString()
      }
    };

    setMetricsCache(newMetrics);
    storage.save(WORKFLOW_METRICS_CACHE, newMetrics);
  }, [metricsCache]);

  // Função para obter métricas de um mês específico
  const getMonthlyMetrics = useCallback((year: number, month: number) => {
    const key = `${year}-${String(month).padStart(2, '0')}`;
    return metricsCache[key] || {
      receita: 0,
      previsto: 0,
      aReceber: 0,
      sessoes: 0,
      lastUpdated: new Date().toISOString()
    };
  }, [metricsCache]);

  // Função para obter métricas de um ano completo
  const getYearlyMetrics = useCallback((year: number) => {
    const yearlyTotals = {
      receita: 0,
      previsto: 0,
      aReceber: 0,
      sessoes: 0
    };

    // Somar todos os meses do ano
    for (let month = 1; month <= 12; month++) {
      const monthlyMetrics = getMonthlyMetrics(year, month);
      yearlyTotals.receita += monthlyMetrics.receita;
      yearlyTotals.previsto += monthlyMetrics.previsto;
      yearlyTotals.aReceber += monthlyMetrics.aReceber;
      yearlyTotals.sessoes += monthlyMetrics.sessoes;
    }

    return yearlyTotals;
  }, [getMonthlyMetrics]);

  // Função para obter métricas por período (mês específico ou ano completo)
  const getMetricsByPeriod = useCallback((
    year: number,
    month?: number // Se não fornecido, retorna o ano completo
  ) => {
    if (month) {
      return getMonthlyMetrics(year, month);
    } else {
      return getYearlyMetrics(year);
    }
  }, [getMonthlyMetrics, getYearlyMetrics]);

  // Função para obter dados mensais do ano para gráficos
  const getMonthlyDataForYear = useCallback((year: number) => {
    const meses = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];
    
    return meses.map((nome, index) => {
      const monthlyMetrics = getMonthlyMetrics(year, index + 1);
      return {
        mes: nome,
        receita: monthlyMetrics.receita,
        previsto: monthlyMetrics.previsto,
        aReceber: monthlyMetrics.aReceber,
        sessoes: monthlyMetrics.sessoes
      };
    });
  }, [getMonthlyMetrics]);

  // Função para limpar cache (para debugging)
  const clearCache = useCallback(() => {
    setMetricsCache({});
    storage.remove(WORKFLOW_METRICS_CACHE);
  }, []);

  // Listener para atualizações externas
  useEffect(() => {
    const handleWorkflowUpdate = (event: CustomEvent) => {
      // Re-carregar cache quando workflow é atualizado
      const updatedCache = storage.load(WORKFLOW_METRICS_CACHE, {});
      setMetricsCache(updatedCache);
    };

    window.addEventListener('workflow-metrics-updated', handleWorkflowUpdate as EventListener);
    
    return () => {
      window.removeEventListener('workflow-metrics-updated', handleWorkflowUpdate as EventListener);
    };
  }, []);

  return {
    saveMonthlyMetrics,
    getMonthlyMetrics,
    getYearlyMetrics,
    getMetricsByPeriod,
    getMonthlyDataForYear,
    clearCache,
    metricsCache
  };
}