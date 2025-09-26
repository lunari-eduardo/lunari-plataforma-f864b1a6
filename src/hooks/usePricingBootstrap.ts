/**
 * Hook for bootstrapping pricing system with Supabase
 * Initializes adapter, runs migration, and preloads data
 */

import { useEffect, useState } from 'react';
import { PricingConfigurationService } from '@/services/PricingConfigurationService';
import { pricingMigrationService } from '@/services/PricingMigrationService';
import { toast } from 'sonner';

export function usePricingBootstrap() {
  const [isInitialized, setIsInitialized] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const initializePricingSystem = async () => {
      try {
        console.log('🔄 Bootstrapping pricing system...');
        
        // Initialize Supabase adapter
        await PricingConfigurationService.initializeSupabaseAdapter();
        console.log('✅ Supabase adapter initialized');

        // Check if migration is needed and execute
        if (pricingMigrationService.isMigrationNeeded()) {
          console.log('🔄 Running pricing data migration...');
          const migrationSuccess = await pricingMigrationService.executeMigration();
          
          if (migrationSuccess) {
            console.log('✅ Pricing migration completed successfully');
          } else {
            console.warn('⚠️ Pricing migration had issues, but continuing...');
          }
        }

        // Preload all pricing data
        const adapter = (PricingConfigurationService as any).adapter;
        if (adapter && typeof adapter.preloadAll === 'function') {
          await adapter.preloadAll();
          console.log('✅ All pricing data preloaded');
        }

        if (isMounted) {
          setIsInitialized(true);
          setError(null);
          console.log('🎉 Pricing system bootstrap completed');
        }
      } catch (err) {
        console.error('❌ Error bootstrapping pricing system:', err);
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Unknown error');
          // Don't prevent app from working due to pricing errors
          setIsInitialized(true);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    initializePricingSystem();

    return () => {
      isMounted = false;
    };
  }, []);

  return {
    isInitialized,
    isLoading,
    error
  };
}