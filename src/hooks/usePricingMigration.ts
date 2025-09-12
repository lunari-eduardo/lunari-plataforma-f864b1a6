/**
 * Hook para migração automática de regras de precificação
 */

import { useEffect, useCallback } from 'react';
import { pricingFreezingService } from '@/services/PricingFreezingService';

export function usePricingMigration() {
  const executarMigracaoSeNecessario = useCallback(async () => {
    try {
      const migrationKey = 'pricing_migration_v1_executed';
      const jaExecutou = localStorage.getItem(migrationKey);
      
      if (!jaExecutou) {
        console.log('🔄 Executando migração de regras de precificação...');
        await pricingFreezingService.migrarSessoesExistentes();
        localStorage.setItem(migrationKey, 'true');
        console.log('✅ Migração de precificação concluída');
      }
    } catch (error) {
      console.error('❌ Erro na migração de precificação:', error);
    }
  }, []);

  useEffect(() => {
    // Executar migração após um pequeno delay para não bloquear o carregamento inicial
    const timer = setTimeout(executarMigracaoSeNecessario, 3000);
    return () => clearTimeout(timer);
  }, [executarMigracaoSeNecessario]);

  return {
    executarMigracaoSeNecessario
  };
}