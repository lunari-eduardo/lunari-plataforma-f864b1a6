import { executarMigracaoDefinitiva } from './migracaoProjetos';

/**
 * SCRIPT PARA EXECUTAR MIGRAÇÃO COMPLETA
 * Execute este comando no console do navegador para migrar para a nova arquitetura
 */
export function executarMigracaoCompleta() {
  console.log('🚀 INICIANDO MIGRAÇÃO COMPLETA PARA ARQUITETURA DE PROJETOS...');
  
  try {
    // Executar migração definitiva
    executarMigracaoDefinitiva();
    
    console.log('✅ MIGRAÇÃO COMPLETA CONCLUÍDA!');
    console.log('📋 Sistema agora usa arquitetura unificada baseada em Projetos');
    console.log('🔄 Recarregando aplicação...');
    
    // Recarregar após 2 segundos
    setTimeout(() => {
      window.location.reload();
    }, 2000);
    
  } catch (error) {
    console.error('❌ ERRO NA MIGRAÇÃO COMPLETA:', error);
    alert('Erro na migração. Verifique o console para detalhes.');
  }
}

// Exportar para uso global
(window as any).executarMigracaoCompleta = executarMigracaoCompleta;