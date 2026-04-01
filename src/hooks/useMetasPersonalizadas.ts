import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { GoalsIntegrationService } from '@/services/GoalsIntegrationService';
import type { MetaPersonalizada, MetaResolvidaParaPeriodo } from '@/types/metas';

export function useMetasPersonalizadas(ano: number) {
  const [metas, setMetas] = useState<MetaPersonalizada[]>([]);
  const [usarPersonalizadas, setUsarPersonalizadasState] = useState(false);
  const [loading, setLoading] = useState(true);

  // Carregar metas e configuração
  useEffect(() => {
    const load = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Buscar config
        const { data: config } = await supabase
          .from('pricing_configuracoes')
          .select('usar_metas_personalizadas')
          .eq('user_id', user.id)
          .maybeSingle();

        setUsarPersonalizadasState(config?.usar_metas_personalizadas ?? false);

        // Buscar metas do ano
        const { data: metasData } = await supabase
          .from('metas_personalizadas' as any)
          .select('*')
          .eq('user_id', user.id)
          .eq('ano', ano)
          .is('categoria', null)
          .order('mes');

        setMetas((metasData as any[]) || []);
      } catch (err) {
        console.error('Erro ao carregar metas:', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [ano]);

  const toggleUsarPersonalizadas = useCallback(async (valor: boolean) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase
      .from('pricing_configuracoes')
      .update({ usar_metas_personalizadas: valor } as any)
      .eq('user_id', user.id);

    setUsarPersonalizadasState(valor);
  }, []);

  const salvarMeta = useCallback(async (mes: number, metaFaturamento: number, metaLucro: number) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from('metas_personalizadas' as any)
      .upsert({
        user_id: user.id,
        ano,
        mes,
        meta_faturamento: metaFaturamento,
        meta_lucro: metaLucro,
        categoria: null
      } as any, {
        onConflict: 'user_id,ano,mes'
      })
      .select()
      .single();

    if (!error && data) {
      setMetas(prev => {
        const existing = prev.findIndex(m => m.mes === mes);
        if (existing >= 0) {
          const updated = [...prev];
          updated[existing] = data as any;
          return updated;
        }
        return [...prev, data as any].sort((a, b) => a.mes - b.mes);
      });
    }
    return { data, error };
  }, [ano]);

  const salvarTodasMetas = useCallback(async (metasArray: { mes: number; meta_faturamento: number; meta_lucro: number }[]) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const rows = metasArray.map(m => ({
      user_id: user.id,
      ano,
      mes: m.mes,
      meta_faturamento: m.meta_faturamento,
      meta_lucro: m.meta_lucro,
      categoria: null
    }));

    const { data, error } = await supabase
      .from('metas_personalizadas' as any)
      .upsert(rows as any[], { onConflict: 'user_id,ano,mes' })
      .select();

    if (!error && data) {
      setMetas((data as any[]).sort((a: any, b: any) => a.mes - b.mes));
    }
    return { data, error };
  }, [ano]);

  // Resolver meta para um mês específico
  const getMetaParaMes = useCallback((mes: number): MetaResolvidaParaPeriodo => {
    if (usarPersonalizadas) {
      const metaCustom = metas.find(m => m.mes === mes);
      if (metaCustom && (metaCustom.meta_faturamento > 0 || metaCustom.meta_lucro > 0)) {
        return {
          metaFaturamento: metaCustom.meta_faturamento,
          metaLucro: metaCustom.meta_lucro,
          origem: 'personalizada'
        };
      }
    }
    // Fallback: precificação / 12
    const annual = GoalsIntegrationService.getAnnualGoals();
    return {
      metaFaturamento: annual.revenue / 12,
      metaLucro: annual.profit / 12,
      origem: 'precificacao'
    };
  }, [usarPersonalizadas, metas]);

  // Resolver meta anual (soma dos 12 meses)
  const getMetaAnual = useCallback((): MetaResolvidaParaPeriodo => {
    if (usarPersonalizadas && metas.length > 0) {
      const totalFat = metas.reduce((s, m) => s + Number(m.meta_faturamento), 0);
      const totalLuc = metas.reduce((s, m) => s + Number(m.meta_lucro), 0);
      if (totalFat > 0 || totalLuc > 0) {
        return {
          metaFaturamento: totalFat,
          metaLucro: totalLuc,
          origem: 'personalizada'
        };
      }
    }
    const annual = GoalsIntegrationService.getAnnualGoals();
    return {
      metaFaturamento: annual.revenue,
      metaLucro: annual.profit,
      origem: 'precificacao'
    };
  }, [usarPersonalizadas, metas]);

  return {
    metas,
    usarPersonalizadas,
    loading,
    toggleUsarPersonalizadas,
    salvarMeta,
    salvarTodasMetas,
    getMetaParaMes,
    getMetaAnual
  };
}
