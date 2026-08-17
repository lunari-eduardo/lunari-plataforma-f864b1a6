/**
 * Main container for pricing configuration
 * Coordinates all pricing-related components and state
 */

import { useState, useEffect, useRef } from 'react';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { PricingValidationService } from '@/services/PricingValidationService';
import { PricingCalculationService } from '@/services/PricingCalculationService';
import { CongelamentoRegrasInfo } from '../CongelamentoRegrasInfo';
import { PricingModelSelector } from './PricingModelSelector';
import { GlobalPricingTable } from './GlobalPricingTable';
import { CategoryPricingConfig } from './CategoryPricingConfig';
import { PricingPreview } from './PricingPreview';
import { toast } from 'sonner';
import type { ConfiguracaoPrecificacao, TabelaPrecos } from '@/types/pricing';

interface PricingContainerProps {
  categorias: Array<{
    id: string;
    nome: string;
    cor?: string | null;
  }>;
}

export function PricingContainer({ categorias }: PricingContainerProps) {
  const [config, setConfig] = useState<ConfiguracaoPrecificacao>({ modelo: 'fixo' });
  const [tabelaGlobal, setTabelaGlobal] = useState<TabelaPrecos | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const initialLoadDone = useRef(false);

  // Hydrate directly from Supabase on mount
  useEffect(() => {
    let isMounted = true;
    const hydrateFromSupabase = async () => {
      try {
        const { data: user } = await supabase.auth.getUser();
        if (!user?.user) return;

        const [modeloRes, globalRes] = await Promise.all([
          supabase.from('modelo_de_preco').select('*').eq('user_id', user.user.id).maybeSingle(),
          supabase.from('tabelas_precos').select('*').eq('user_id', user.user.id).eq('tipo', 'global').maybeSingle(),
        ]);

        if (!isMounted) return;

        if (modeloRes.data?.modelo) {
          setConfig({
            id: modeloRes.data.id,
            user_id: modeloRes.data.user_id,
            modelo: modeloRes.data.modelo as 'fixo' | 'global' | 'categoria',
            created_at: modeloRes.data.created_at,
            updated_at: modeloRes.data.updated_at
          });
        }

        if (globalRes.data) {
          setTabelaGlobal({
            id: globalRes.data.id,
            user_id: globalRes.data.user_id,
            nome: globalRes.data.nome,
            faixas: Array.isArray(globalRes.data.faixas)
              ? (globalRes.data.faixas as any[]).map((f: any) => ({
                  min: f.min ?? f.de ?? 1,
                  max: f.max ?? (f.ate === 999999 ? null : (f.ate ?? null)),
                  valor: f.valor ?? f.valor_foto_extra ?? 0,
                }))
              : [],
            usar_valor_fixo_pacote: globalRes.data.usar_valor_fixo_pacote ?? false,
            created_at: globalRes.data.created_at,
            updated_at: globalRes.data.updated_at
          });
        }
      } catch (error) {
        console.error('Error hydrating pricing from Supabase:', error);
      } finally {
        if (isMounted) {
          setHydrated(true);
          initialLoadDone.current = true;
        }
      }
    };

    hydrateFromSupabase();
    return () => {
      isMounted = false;
    };
  }, []);

  // Save configuration on change (only after initial hydration is complete)
  const handleModeloChange = async (novoModelo: 'fixo' | 'global' | 'categoria') => {
    const validation = PricingValidationService.validarConfiguracao(novoModelo);
    if (!validation.valid) {
      console.error('Invalid pricing model:', validation.errors);
      return;
    }

    const updatedConfig = { ...config, modelo: novoModelo };
    setConfig(updatedConfig);

    // Create global table if switching to global model and none exists
    let activeGlobalTable = tabelaGlobal;
    if (novoModelo === 'global' && !tabelaGlobal) {
      const novaTabela = PricingCalculationService.criarTabelaExemplo();
      setTabelaGlobal(novaTabela);
      activeGlobalTable = novaTabela;
    }

    try {
      const { data: user } = await supabase.auth.getUser();
      if (user?.user) {
        await supabase
          .from('modelo_de_preco')
          .upsert({
            user_id: user.user.id,
            modelo: novoModelo
          }, {
            onConflict: 'user_id'
          });

        if (novoModelo === 'global' && activeGlobalTable) {
          await supabase
            .from('tabelas_precos')
            .upsert({
              id: activeGlobalTable.id || crypto.randomUUID(),
              user_id: user.user.id,
              nome: activeGlobalTable.nome,
              tipo: 'global',
              categoria_id: null,
              faixas: activeGlobalTable.faixas as any,
              usar_valor_fixo_pacote: activeGlobalTable.usar_valor_fixo_pacote ?? false
            }, {
              onConflict: 'id'
            });
        }

        toast.success(`Modelo de preço alterado para: ${
          novoModelo === 'categoria' ? 'Desconto por Categoria' :
          novoModelo === 'global' ? 'Desconto Global' : 'Fixo por Pacote'
        }`);
      }
    } catch (error) {
      console.error('Error saving pricing model:', error);
      toast.error('Erro ao salvar modelo de preço');
    }
  };

  const handleGlobalTableChange = async (novaTabela: TabelaPrecos) => {
    setTabelaGlobal(novaTabela);
    if (!hydrated) return;

    try {
      const { data: user } = await supabase.auth.getUser();
      if (user?.user) {
        await supabase
          .from('tabelas_precos')
          .upsert({
            id: novaTabela.id || crypto.randomUUID(),
            user_id: user.user.id,
            nome: novaTabela.nome,
            tipo: 'global',
            categoria_id: null,
            faixas: novaTabela.faixas as any,
            usar_valor_fixo_pacote: novaTabela.usar_valor_fixo_pacote ?? false
          }, {
            onConflict: 'id'
          });
      }
    } catch (error) {
      console.error('Error saving global table:', error);
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
          onTableChange={handleGlobalTableChange}
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