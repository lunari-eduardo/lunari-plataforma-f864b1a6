import { useState, useEffect, useCallback } from 'react';

interface WorkflowMonthlyMetrics {
  [key: string]: { // formato: "2024-08"
    receita: number;      // Valor pago
    previsto: number;     // Total calculado dinamicamente
    aReceber: number;     // Restante calculado dinamicamente  
    sessoes: number;      // Quantidade de sessões
    lastUpdated: string;  // Para invalidação
  }
}

interface MonthlyMetrics {
  receita: number;
  previsto: number;
  aReceber: number;
  sessoes: number;
}

export function useWorkflowMetrics() {
  const [cache, setCache] = useState<WorkflowMonthlyMetrics>(() => {
    try {
      const saved = localStorage.getItem('workflow_monthly_metrics');
      return saved ? JSON.parse(saved) : {};
    } catch (error) {
      console.error('❌ Erro ao carregar cache de métricas:', error);
      return {};
    }
  });

  // Salvar cache no localStorage sempre que mudar
  useEffect(() => {
    try {
      localStorage.setItem('workflow_monthly_metrics', JSON.stringify(cache));
    } catch (error) {
      console.error('❌ Erro ao salvar cache de métricas:', error);
    }
  }, [cache]);

  // Função para salvar métricas de um mês
  const saveMonthlyMetrics = useCallback((year: number, month: number, metrics: MonthlyMetrics) => {
    const key = `${year}-${month.toString().padStart(2, '0')}`;
    const metricsWithTimestamp = {
      ...metrics,
      lastUpdated: new Date().toISOString()
    };

    setCache(prev => ({
      ...prev,
      [key]: metricsWithTimestamp
    }));

    // Disparar evento para outras páginas se sincronizarem
    window.dispatchEvent(new CustomEvent('workflowMetricsUpdated', { 
      detail: { key, metrics: metricsWithTimestamp } 
    }));
  }, []);

  // Função para obter métricas de um mês
  const getMonthlyMetrics = useCallback((year: number, month: number): MonthlyMetrics | null => {
    const key = `${year}-${month.toString().padStart(2, '0')}`;
    return cache[key] || null;
  }, [cache]);

  // Função para obter métricas anuais (soma todos os meses do ano)
  const getAnnualMetrics = useCallback((year: number): MonthlyMetrics => {
    const annual = { receita: 0, previsto: 0, aReceber: 0, sessoes: 0 };
    
    for (let month = 1; month <= 12; month++) {
      const monthlyMetrics = getMonthlyMetrics(year, month);
      if (monthlyMetrics) {
        annual.receita += monthlyMetrics.receita;
        annual.previsto += monthlyMetrics.previsto;
        annual.aReceber += monthlyMetrics.aReceber;
        annual.sessoes += monthlyMetrics.sessoes;
      }
    }
    
    return annual;
  }, [getMonthlyMetrics]);

  // Função para obter anos disponíveis no cache
  const getAvailableYears = useCallback((): number[] => {
    const years = new Set<number>();
    
    Object.keys(cache).forEach(key => {
      const [year] = key.split('-');
      years.add(parseInt(year));
    });

    if (years.size === 0) {
      years.add(new Date().getFullYear());
    }

    return Array.from(years).sort((a, b) => b - a);
  }, [cache]);

  // Função para limpar cache antigo (opcional)
  const clearOldCache = useCallback((keepMonths = 24) => {
    const cutoffDate = new Date();
    cutoffDate.setMonth(cutoffDate.getMonth() - keepMonths);
    
    const newCache: WorkflowMonthlyMetrics = {};
    
    Object.entries(cache).forEach(([key, metrics]) => {
      const [year, month] = key.split('-').map(Number);
      const metricDate = new Date(year, month - 1);
      
      if (metricDate >= cutoffDate) {
        newCache[key] = metrics;
      }
    });
    
    setCache(newCache);
  }, [cache]);

  return {
    saveMonthlyMetrics,
    getMonthlyMetrics,
    getAnnualMetrics,
    getAvailableYears,
    clearOldCache,
    cache
  };
}