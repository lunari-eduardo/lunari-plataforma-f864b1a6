/**
 * Hook global para acesso rápido às metas de precificação
 * Usa localStorage como cache instantâneo e sincroniza com Supabase em background
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { MetasService } from '@/services/PricingService';
import type { MetasPrecificacao } from '@/types/precificacao';

interface UsePricingMetasReturn {
  metas: MetasPrecificacao;
  loading: boolean;
  refresh: () => Promise<void>;
  monthlyRevenue: number;
  monthlyProfit: number;
  hasConfiguredGoals: boolean;
}

export function usePricingMetas(): UsePricingMetasReturn {
  // Inicialização instantânea do localStorage
  const [metas, setMetas] = useState<MetasPrecificacao>(() => {
    try {
      return MetasService.carregar();
    } catch {
      return {
        margemLucroDesejada: 30,
        ano: new Date().getFullYear(),
        metaFaturamentoAnual: 0,
        metaLucroAnual: 0
      };
    }
  });
  const [loading, setLoading] = useState(false);

  // Sincronização com Supabase em background
  const syncWithSupabase = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('pricing_configuracoes')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) {
        console.error('Erro ao buscar metas do Supabase:', error);
        return;
      }

      if (data) {
        const metasFromDb: MetasPrecificacao = {
          margemLucroDesejada: data.margem_lucro_desejada || 30,
          ano: data.ano_meta || new Date().getFullYear(),
          metaFaturamentoAnual: data.meta_faturamento_anual || 0,
          metaLucroAnual: data.meta_lucro_anual || 0
        };

        // Atualizar estado
        setMetas(metasFromDb);
        
        // Sincronizar localStorage para próximo acesso instantâneo
        MetasService.salvar(metasFromDb);
        
        console.log('✅ Metas sincronizadas do Supabase');
      }
    } catch (error) {
      console.error('Erro na sincronização de metas:', error);
    }
  }, []);

  // Executar sync em background ao montar
  useEffect(() => {
    syncWithSupabase();
  }, [syncWithSupabase]);

  // Função para forçar refresh
  const refresh = useCallback(async () => {
    setLoading(true);
    await syncWithSupabase();
    setLoading(false);
  }, [syncWithSupabase]);

  // Valores calculados
  const monthlyRevenue = metas.metaFaturamentoAnual / 12;
  const monthlyProfit = metas.metaLucroAnual / 12;
  const hasConfiguredGoals = metas.metaFaturamentoAnual > 0 || metas.metaLucroAnual > 0;

  return {
    metas,
    loading,
    refresh,
    monthlyRevenue,
    monthlyProfit,
    hasConfiguredGoals
  };
}
