/**
 * Main container for pricing configuration
 * Coordinates all pricing-related components and state
 */

import { useState, useEffect } from 'react';
import { Separator } from '@/components/ui/separator';
import { PricingConfigurationService } from '@/services/PricingConfigurationService';
import { PricingValidationService } from '@/services/PricingValidationService';
import { PricingCalculationService } from '@/services/PricingCalculationService';
import { CongelamentoRegrasInfo } from '../CongelamentoRegrasInfo';
import { PricingModelSelector } from './PricingModelSelector';
import { GlobalPricingTable } from './GlobalPricingTable';
import { CategoryPricingConfig } from './CategoryPricingConfig';
import { PricingPreview } from './PricingPreview';
import type { ConfiguracaoPrecificacao, TabelaPrecos } from '@/types/pricing';

interface PricingContainerProps {
  categorias: Array<{
    id: string;
    nome: string;
    cor: string;
  }>;
}

export function PricingContainer({ categorias }: PricingContainerProps) {
  const [config, setConfig] = useState<ConfiguracaoPrecificacao>(() => 
    PricingConfigurationService.loadConfiguration()
  );
  const [tabelaGlobal, setTabelaGlobal] = useState<TabelaPrecos | null>(() =>
    PricingConfigurationService.loadGlobalTable()
  );
  const [hydrated, setHydrated] = useState(false);

  // Hydrate from Supabase on mount
  useEffect(() => {
    const hydrateFromSupabase = async () => {
      try {
        const adapter = PricingConfigurationService['adapter'] as any;
        if (adapter && typeof adapter.loadConfigurationAsync === 'function') {
          const supabaseConfig = await adapter.loadConfigurationAsync();
          if (supabaseConfig) {
            setConfig(supabaseConfig);
          }
        }
        if (adapter && typeof adapter.loadGlobalTableAsync === 'function') {
          const supabaseGlobalTable = await adapter.loadGlobalTableAsync();
          if (supabaseGlobalTable) {
            setTabelaGlobal(supabaseGlobalTable);
          }
        }
      } catch (error) {
        console.error('Error hydrating from Supabase:', error);
      } finally {
        setHydrated(true);
      }
    };

    hydrateFromSupabase();
  }, []);

  // Auto-save configuration (skip first render)
  useEffect(() => {
    if (!hydrated) return;
    
    const saveConfig = async () => {
      try {
        await PricingConfigurationService.saveConfiguration(config);
      } catch (error) {
        console.error('Error saving configuration:', error);
      }
    };
    
    saveConfig();
  }, [config, hydrated]);

  // Auto-save global table (skip first render)
  useEffect(() => {
    if (!hydrated) return;
    
    const saveTable = async () => {
      if (tabelaGlobal) {
        try {
          await PricingConfigurationService.saveGlobalTable(tabelaGlobal);
        } catch (error) {
          console.error('Error saving global table:', error);
        }
      }
    };
    
    saveTable();
  }, [tabelaGlobal, hydrated]);

  const handleModeloChange = (novoModelo: 'fixo' | 'global' | 'categoria') => {
    const validation = PricingValidationService.validarConfiguracao(novoModelo);
    if (!validation.valid) {
      console.error('Invalid pricing model:', validation.errors);
      return;
    }

    setConfig(prev => ({
      ...prev,
      modelo: novoModelo
    }));

    // Create global table if switching to global model and none exists
    if (novoModelo === 'global' && !tabelaGlobal) {
      const novaTabela = PricingCalculationService.criarTabelaExemplo();
      setTabelaGlobal(novaTabela);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h3 className="font-semibold text-base">Precificação de Fotos Extras</h3>
        <p className="text-muted-foreground mt-1 text-xs">
          Configure como os preços de fotos extras serão calculados no sistema.
        </p>
      </div>

      {/* Model Selector */}
      <PricingModelSelector 
        currentModel={config.modelo}
        onModelChange={handleModeloChange}
      />

      {/* Global Table Configuration */}
      {config.modelo === 'global' && (
        <GlobalPricingTable 
          table={tabelaGlobal}
          onTableChange={setTabelaGlobal}
        />
      )}

      {/* Category Configuration */}
      {config.modelo === 'categoria' && (
        <CategoryPricingConfig categorias={categorias} />
      )}

      {/* Preview */}
      <PricingPreview 
        model={config.modelo}
        globalTable={tabelaGlobal}
        categorias={categorias}
      />

      <Separator />

      {/* Important Information */}
      <CongelamentoRegrasInfo />
    </div>
  );
}