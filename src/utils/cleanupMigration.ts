/**
 * LIMPEZA FINAL DA MIGRAÇÃO INVERTIDA
 * Remove referências antigas e otimiza o sistema
 */

export function cleanupAfterMigration() {
  try {
    console.log('🧹 Iniciando limpeza pós-migração...');
    
    // 1. Verificar se migração foi bem-sucedida
    const workflowSessions = JSON.parse(localStorage.getItem('workflow_sessions') || '[]');
    const lunariWorkflowItems = JSON.parse(localStorage.getItem('lunari_workflow_items') || '[]');
    
    console.log('📊 Status da migração:', {
      workflowSessions: workflowSessions.length,
      lunariWorkflowItems: lunariWorkflowItems.length
    });
    
    // 2. Se workflow_sessions tem dados, pode remover lunari_workflow_items
    if (workflowSessions.length > 0) {
      // Criar backup final antes de remover
      if (lunariWorkflowItems.length > 0) {
        localStorage.setItem('backup_lunari_workflow_items_final', JSON.stringify({
          data: lunariWorkflowItems,
          timestamp: new Date().toISOString(),
          migratedTo: 'workflow_sessions'
        }));
      }
      
      // Remover lunari_workflow_items (agora obsoleto)
      localStorage.removeItem('lunari_workflow_items');
      console.log('🗑️ lunari_workflow_items removido - migração para workflow_sessions concluída');
    }
    
    // 3. Remover caches antigos
    const cachesToRemove = [
      'unified_workflow_cache',
      'client_metrics_cache_old',
      'workflow_sync_timestamp'
    ];
    
    cachesToRemove.forEach(cache => {
      if (localStorage.getItem(cache)) {
        localStorage.removeItem(cache);
        console.log(`🗑️ Cache removido: ${cache}`);
      }
    });
    
    // 4. Marcar limpeza como concluída
    localStorage.setItem('migration_cleanup_completed', JSON.stringify({
      completedAt: new Date().toISOString(),
      version: '1.0.0'
    }));
    
    console.log('✅ Limpeza pós-migração concluída com sucesso!');
    
  } catch (error) {
    console.error('❌ Erro durante limpeza pós-migração:', error);
  }
}

/**
 * Rollback de emergência
 */
export function emergencyRollback() {
  try {
    const backup = localStorage.getItem('backup_before_inverted_migration');
    if (backup) {
      const { lunariWorkflowItems } = JSON.parse(backup);
      localStorage.setItem('lunari_workflow_items', JSON.stringify(lunariWorkflowItems));
      
      // Remover flags de migração
      localStorage.removeItem('inverted_migration_completed');
      localStorage.removeItem('migration_cleanup_completed');
      
      console.log('🔄 Rollback de emergência executado - lunari_workflow_items restaurado');
    } else {
      console.warn('⚠️ Nenhum backup encontrado para rollback');
    }
  } catch (error) {
    console.error('❌ Erro durante rollback de emergência:', error);
  }
}