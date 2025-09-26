/**
 * Hook para migração automática de regras de precificação
 */

import { useEffect, useCallback } from 'react';
import { pricingFreezingService } from '@/services/PricingFreezingService';
import { usePricingSupabase } from './usePricingSupabase';

export function usePricingMigration() {
  const { isInitialized, isLoading } = usePricingSupabase();
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

      // Nova correção específica para modelo categoria
      const categoryFixKey = 'pricing_category_fix_v1_executed';
      const jaCatCorrigiu = localStorage.getItem(categoryFixKey);
      
      if (!jaCatCorrigiu) {
        console.log('🔧 Executando correção específica para modelo categoria...');
        await pricingFreezingService.corrigirModeloCategoria();
        localStorage.setItem(categoryFixKey, 'true');
        console.log('✅ Correção modelo categoria concluída');
      }
    } catch (error) {
      console.error('❌ Erro na migração/correção de precificação:', error);
    }
  }, []);

  useEffect(() => {
    // Only run migration corrections after Supabase is initialized
    if (!isInitialized || isLoading) return;
    
    // Executar migração após um pequeno delay para não bloquear o carregamento inicial
    const timer = setTimeout(executarMigracaoSeNecessario, 3000);
    return () => clearTimeout(timer);
  }, [executarMigracaoSeNecessario, isInitialized, isLoading]);

  return {
    executarMigracaoSeNecessario,
    isSupabaseReady: isInitialized && !isLoading
  };
}