/**
 * UTILITÁRIO PARA LOGS PRODUTIVOS
 * Substitui console.log desnecessários por logs condicionais
 */

// Função para logs apenas em desenvolvimento ou com flag específica
export const devLog = (message: string, data?: any): void => {
  if (import.meta.env.DEV && window.location.search.includes('debug=true')) {
    console.log(message, data);
  }
};

// Função para logs críticos apenas (erros reais)
export const criticalLog = (message: string, error?: any): void => {
  console.warn('🚨 CRÍTICO:', message, error);
};

// Função silenciosa para substituir logs antigos
export const silentLog = (_message: string, _data?: any): void => {
  // Não faz nada - substitui console.logs problemáticos
};