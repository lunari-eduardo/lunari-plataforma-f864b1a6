import { ProjetoService } from '@/services/ProjetoService';

/**
 * SCRIPT DE MIGRAÇÃO DEFINITIVA
 * Executa a transição completa para arquitetura baseada em Projetos
 */
export function executarMigracaoDefinitiva() {
  console.log('🚀 INICIANDO MIGRAÇÃO DEFINITIVA PARA PROJETOS...');
  
  try {
    // FASE 1: Migrar dados existentes
    ProjetoService.migrarDadosExistentes();
    
    // FASE 2: Deduplicar projetos
    ProjetoService.deduplicarProjetos();
    
    // FASE 3: Backup dos dados antigos
    const workflowSessions = localStorage.getItem('workflow_sessions');
    if (workflowSessions) {
      localStorage.setItem('workflow_sessions_backup', workflowSessions);
      console.log('📦 Backup criado: workflow_sessions_backup');
    }
    
    // FASE 4: Limpar dados legados (opcional)
    // localStorage.removeItem('workflow_sessions');
    
    console.log('✅ MIGRAÇÃO CONCLUÍDA COM SUCESSO!');
    console.log('📋 Resultado: Sistema agora usa arquitetura unificada de Projetos');
    
    // Recarregar página para aplicar mudanças
    window.location.reload();
    
  } catch (error) {
    console.error('❌ ERRO NA MIGRAÇÃO:', error);
    alert('Erro na migração. Verifique o console.');
  }
}

// Função para reverter migração se necessário
export function reverterMigracaoSeNecessario() {
  const backup = localStorage.getItem('workflow_sessions_backup');
  if (backup) {
    localStorage.setItem('workflow_sessions', backup);
    console.log('🔄 Migração revertida');
    window.location.reload();
  }
}