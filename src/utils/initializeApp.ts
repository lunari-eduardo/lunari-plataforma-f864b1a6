import { fixClienteIdCorruption, detectClienteIdCorruptions } from './fixClienteIdCorruption';
import { migrateWorkflowClienteId } from './migrateWorkflowClienteId';
import { migrateToWorkflowSessions } from './migrateToWorkflowSessions';
import { cleanupAfterMigration } from './cleanupMigration';
import { toast } from 'sonner';

/**
 * Sistema de inicialização completo do app
 * Executa todas as migrações, correções e otimizações necessárias
 */

interface InitializationResult {
  success: boolean;
  migrationsRun: string[];
  errors: string[];
  warnings: string[];
}

/**
 * Função principal de inicialização
 * Deve ser chamada uma única vez na inicialização do app
 */
export async function initializeApp(): Promise<InitializationResult> {
  // Log de inicialização removido para evitar spam
  
  const result: InitializationResult = {
    success: true,
    migrationsRun: [],
    errors: [],
    warnings: []
  };
  
  try {
    // 1. DETECTAR PROBLEMAS ATUAIS
    // Log removido para evitar spam
    const corruptions = detectClienteIdCorruptions();
    
    if (corruptions.workflowItemsCorrupted > 0 || corruptions.sessionsCorrupted > 0) {
      console.warn('⚠️ Corrupções detectadas:', corruptions);
      result.warnings.push(`Corrupções encontradas: ${corruptions.workflowItemsCorrupted + corruptions.sessionsCorrupted} itens`);
    }
    
    // 2. EXECUTAR MIGRAÇÃO DE CLIENTEID (SE NECESSÁRIO)
    const migrationAlreadyRun = localStorage.getItem('workflow_clienteId_migrated') === 'true';
    if (!migrationAlreadyRun) {
      // Log removido para evitar spam
  migrateWorkflowClienteId();
  
  // MIGRAÇÃO INVERTIDA: Consolidar dados para workflow_sessions
  migrateToWorkflowSessions();
  
  // LIMPEZA PÓS-MIGRAÇÃO: Remover dados obsoletos
  cleanupAfterMigration();
      result.migrationsRun.push('migrateWorkflowClienteId');
    }
    
    // 3. CORRIGIR CORRUPÇÕES DE CLIENTEID
    const corruptionAlreadyFixed = localStorage.getItem('clienteId_corruption_fixed');
    const needsCorruptionFix = corruptions.workflowItemsCorrupted > 0 || 
                              corruptions.sessionsCorrupted > 0 || 
                              !corruptionAlreadyFixed;
    
    if (needsCorruptionFix) {
      // Log removido para evitar spam
      const fixResult = fixClienteIdCorruption();
      result.migrationsRun.push('fixClienteIdCorruption');
      
      if (fixResult.workflowItemsFixed + fixResult.sessionsFixed > 0) {
        const message = `Corrigidos ${fixResult.workflowItemsFixed + fixResult.sessionsFixed} itens corrompidos`;
        console.log('✅', message);
        result.warnings.push(message);
      }
    }
    
    // 4. LIMPEZA DE CACHES ANTIGOS
    // Log removido para evitar spam
    const cachesToClear = [
      'workflow_sync_data',
      'unified_workflow_cache',
      'client_metrics_cache'
    ];
    
    cachesToClear.forEach(cache => {
      if (localStorage.getItem(cache)) {
        localStorage.removeItem(cache);
        // Log removido para evitar spam
      }
    });
    
    // 5. OTIMIZAÇÃO DE PERFORMANCE
    // Log removido para evitar spam
    
    // Configurar debounce para operações pesadas
    const performanceConfig = {
      syncDebounceMs: 100,
      metricsDebounceMs: 500,
      logsReduced: true,
      lastOptimized: new Date().toISOString()
    };
    
    localStorage.setItem('performance_config', JSON.stringify(performanceConfig));
    result.migrationsRun.push('performanceOptimization');
    
    // 6. VERIFICAÇÃO FINAL
    // Log removido para evitar spam
    const finalCorruptions = detectClienteIdCorruptions();
    
    if (finalCorruptions.workflowItemsCorrupted > 0 || finalCorruptions.sessionsCorrupted > 0) {
      const errorMsg = `Ainda existem ${finalCorruptions.workflowItemsCorrupted + finalCorruptions.sessionsCorrupted} corrupções`;
      console.error('❌', errorMsg);
      result.errors.push(errorMsg);
      result.success = false;
    }
    
    // 7. MARCAR INICIALIZAÇÃO COMO CONCLUÍDA
    const initializationData = {
      completedAt: new Date().toISOString(),
      version: '1.0.0',
      migrationsRun: result.migrationsRun,
      success: result.success
    };
    
    localStorage.setItem('app_initialized', JSON.stringify(initializationData));
    
    // 8. RESULTADO FINAL
    if (result.success) {
      // Logs removidos para evitar spam no console
      
      // Toast de sucesso apenas se houve correções importantes
      if (result.migrationsRun.length > 0 || result.warnings.length > 0) {
        toast.success('Sistema otimizado e corrigido com sucesso!', {
          description: `${result.migrationsRun.length} otimizações aplicadas`
        });
      }
    } else {
      console.error('❌ Inicialização concluída com erros:', result.errors);
      toast.error('Problemas detectados no sistema', {
        description: 'Verifique o console para detalhes'
      });
    }
    
    return result;
    
  } catch (error) {
    console.error('💥 Erro crítico durante inicialização:', error);
    result.success = false;
    result.errors.push(`Erro crítico: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    
    toast.error('Erro na inicialização do sistema', {
      description: 'Consulte o console para mais informações'
    });
    
    return result;
  }
}

/**
 * Verifica se o app precisa de inicialização
 */
export function needsInitialization(): boolean {
  const initialized = localStorage.getItem('app_initialized');
  
  if (!initialized) {
    return true;
  }
  
  try {
    const initData = JSON.parse(initialized);
    
    // Se não foi bem-sucedida, precisa reinicializar
    if (!initData.success) {
      return true;
    }
    
    // Se é muito antiga (mais de 7 dias), reinicializar
    const initDate = new Date(initData.completedAt);
    const daysSinceInit = (Date.now() - initDate.getTime()) / (1000 * 60 * 60 * 24);
    
    if (daysSinceInit > 7) {
      console.log('🔄 Inicialização antiga detectada, será reexecutada');
      return true;
    }
    
    return false;
  } catch {
    return true;
  }
}

/**
 * Forçar reinicialização (para debug)
 */
export function forceReinitialize(): void {
  localStorage.removeItem('app_initialized');
  localStorage.removeItem('workflow_clienteId_migrated');
  localStorage.removeItem('clienteId_corruption_fixed');
  console.log('🔄 Marcadores de inicialização removidos - próxima inicialização será completa');
}