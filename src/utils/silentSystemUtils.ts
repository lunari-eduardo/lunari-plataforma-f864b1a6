/**
 * VERSÃO SILENCIOSA DE UTILITÁRIOS DO SISTEMA
 * Para evitar spam de console logs durante operações rotineiras
 */

// Função silenciosa para substituir logs verbosos de inicialização
export const initSystem = (): void => {
  // Verificação silenciosa se sistema já foi inicializado
  const systemInitialized = localStorage.getItem('system_initialized') === 'true';
  
  if (!systemInitialized) {
    // Executar verificações básicas sem logs
    try {
      // Verificação básica de dados
      const hasData = localStorage.getItem('lunari_app_version');
      
      // Marcar como inicializado
      localStorage.setItem('system_initialized', 'true');
      localStorage.setItem('last_init', new Date().toISOString());
      
      if (!hasData) {
        localStorage.setItem('lunari_app_version', '2.0.0');
      }
    } catch {
      // Falha silenciosa - não interromper app
    }
  }
};

// Substituição silenciosa para console.log problemático
export const silentOperation = <T>(operation: () => T): T | null => {
  try {
    return operation();
  } catch {
    return null;
  }
};

// Logger condicional - só ativa com debug=true na URL
export const conditionalLog = (message: string, data?: any): void => {
  if (typeof window !== 'undefined' && window.location.search.includes('debug=true')) {
    console.log(message, data);
  }
};