/**
 * Hook para migração automática de regras de precificação
 */

import { useEffect, useCallback } from 'react';
import { pricingFreezingService } from '@/services/PricingFreezingService';

export function usePricingMigration() {
  const executarMigracaoSeNecessario = useCallback(async () => {
    try {
      const migrationKey = 'pricing_migration_v1_executed';
      const correctionKey = 'pricing_correction_v1_executed';
      const jaExecutou = localStorage.getItem(migrationKey);
      const jaCorrigiu = localStorage.getItem(correctionKey);
      
      if (!jaExecutou) {
        console.log('🔄 Executando migração de regras de precificação...');
        await pricingFreezingService.migrarSessoesExistentes();
        localStorage.setItem(migrationKey, 'true');
        console.log('✅ Migração de precificação concluída');
      }

      if (!jaCorrigiu) {
        console.log('🔧 Executando correção de dados inconsistentes...');
        await pricingFreezingService.corrigirSessoesInconsistentes();
        localStorage.setItem(correctionKey, 'true');
        console.log('✅ Correção de dados inconsistentes concluída');
      }
    } catch (error) {
      console.error('❌ Erro na migração/correção de precificação:', error);
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