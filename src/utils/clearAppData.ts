import { storage } from './localStorage';

/**
 * Limpa todos os dados da aplicação do localStorage
 * Use esta função para reset completo do sistema
 */
export const clearAllAppData = () => {
  storage.clearAllAppData();
  console.log('Todos os dados da aplicação foram limpos com sucesso.');
};

/**
 * Função para executar no console do navegador para limpar dados
 * Execute no DevTools: window.clearAppData()
 */
export const initializeDevTools = () => {
  (window as any).clearAppData = clearAllAppData;
  console.log('Função clearAppData disponível no console global.');
};