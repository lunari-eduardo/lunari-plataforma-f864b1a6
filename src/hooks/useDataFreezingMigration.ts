/**
 * Hook para migração automática de dados congelados
 * Executa na inicialização do sistema
 */

import { useState, useEffect } from 'react';
import { toast } from '@/hooks/use-toast';

export const useDataFreezingMigration = () => {
  const [migrationStatus, setMigrationStatus] = useState<{
    isRunning: boolean;
    completed: boolean;
    error?: string;
    stats?: { migrated: number; skipped: number };
  }>({
    isRunning: false,
    completed: false
  });

  // Execute migration on mount
  useEffect(() => {
    const executeMigration = async () => {
      try {
        setMigrationStatus({ isRunning: true, completed: false });
        
        const { pricingFreezingService } = await import('@/services/PricingFreezingService');
        const stats = await pricingFreezingService.migrarSessoesExistentes();
        
        setMigrationStatus({
          isRunning: false,
          completed: true,
          stats
        });

        if (stats.migrated > 0) {
          toast({
            title: "Migração de dados concluída",
            description: `${stats.migrated} sessões atualizadas com dados congelados.`,
          });
        }
        
      } catch (error) {
        console.error('❌ Erro na migração automática:', error);
        setMigrationStatus({
          isRunning: false,
          completed: false,
          error: error instanceof Error ? error.message : 'Erro desconhecido'
        });
        
        toast({
          title: "Erro na migração de dados",
          description: "Algumas sessões podem não ter dados históricos preservados.",
          variant: "destructive",
        });
      }
    };

    // Execute migration with delay to avoid conflicts with other initializations
    const timer = setTimeout(executeMigration, 2000);
    
    return () => clearTimeout(timer);
  }, []);

  return migrationStatus;
};