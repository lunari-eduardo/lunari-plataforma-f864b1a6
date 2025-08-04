import { autoFixIfNeeded } from './crmDataFix';

/**
 * Inicialização da aplicação com correção automática
 */
export function initializeAppWithFix(): void {
  console.log('🚀 Inicializando aplicação...');
  
  // Executar correção automática dos dados do CRM
  autoFixIfNeeded();
  
  console.log('✅ Aplicação inicializada com dados corrigidos');
}