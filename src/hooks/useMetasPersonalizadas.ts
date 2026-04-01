import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { GoalsIntegrationService } from '@/services/GoalsIntegrationService';
import type { MetaPersonalizada, MetaResolvidaParaPeriodo } from '@/types/metas';

export function useMetasPersonalizadas(ano: number) {
  const [metas, setMetas] = useState<MetaPersonalizada[]>([]);
  const [metasPorCategoria, setMetasPorCategoria] = useState<MetaPersonalizada[]>([]);
  const [usarPersonalizadas, setUsarPersonalizadasState] = useState(false);
  const [modoMetas, setModoMetasState] = useState<'mensal' | 'categoria'>('mensal');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: config } = await supabase
          .from('pricing_configuracoes')
          .select('usar_metas_personalizadas, modo_metas')
          .eq('user_id', user.id)
          .maybeSingle();

        setUsarPersonalizadasState(config?.usar_metas_personalizadas ?? false);
        setModoMetasState((config as any)?.modo_metas ?? 'mensal');

        const { data: metasData } = await supabase
          .from('metas_personalizadas' as any)
          .select('*')
          .eq('user_id', user.id)
          .eq('ano', ano)
          .order('mes');

        const all = (metasData as any[]) || [];
        setMetas(all.filter(m => m.categoria === '__geral__'));
        setMetasPorCategoria(all.filter(m => m.categoria !== '__geral__'));
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

  const setModoMetas = useCallback(async (modo: 'mensal' | 'categoria') => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase
      .from('pricing_configuracoes')
      .update({ modo_metas: modo } as any)
      .eq('user_id', user.id);
    setModoMetasState(modo);
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
        categoria: '__geral__'
      } as any, {
        onConflict: 'user_id,ano,mes,categoria'
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
      categoria: '__geral__'
    }));

    const { data, error } = await supabase
      .from('metas_personalizadas' as any)
      .upsert(rows as any[], { onConflict: 'user_id,ano,mes,categoria' })
      .select();

    if (!error && data) {
      setMetas((data as any[]).filter((m: any) => m.categoria === '__geral__').sort((a: any, b: any) => a.mes - b.mes));
    }
    return { data, error };
  }, [ano]);

  const salvarMetaCategoria = useCallback(async (mes: number, categoriaId: string, metaFaturamento: number, metaLucro: number) => {
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
        categoria: categoriaId
      } as any, {
        onConflict: 'user_id,ano,mes,categoria'
      })
      .select()
      .single();

    if (!error && data) {
      setMetasPorCategoria(prev => {
        const idx = prev.findIndex(m => m.mes === mes && m.categoria === categoriaId);
        if (idx >= 0) {
          const updated = [...prev];
          updated[idx] = data as any;
          return updated;
        }
        return [...prev, data as any];
      });
    }
    return { data, error };
  }, [ano]);

  const removerMetaCategoria = useCallback(async (mes: number, categoriaId: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase
      .from('metas_personalizadas' as any)
      .delete()
      .eq('user_id', user.id)
      .eq('ano', ano)
      .eq('mes', mes)
      .eq('categoria', categoriaId);

    setMetasPorCategoria(prev => prev.filter(m => !(m.mes === mes && m.categoria === categoriaId)));
  }, [ano]);

  const getMetaParaMes = useCallback((mes: number): MetaResolvidaParaPeriodo => {
    if (usarPersonalizadas) {
      if (modoMetas === 'mensal') {
        const metaCustom = metas.find(m => m.mes === mes);
        if (metaCustom && metaCustom.meta_lucro > 0) {
          return {
            metaFaturamento: 0,
            metaLucro: metaCustom.meta_lucro,
            origem: 'personalizada'
          };
        }
      }
      // In category mode, no per-month custom goal
    }
    const annual = GoalsIntegrationService.getAnnualGoals();
    return {
      metaFaturamento: annual.revenue / 12,
      metaLucro: annual.profit / 12,
      origem: 'precificacao'
    };
  }, [usarPersonalizadas, modoMetas, metas]);

  const getMetaAnual = useCallback((): MetaResolvidaParaPeriodo => {
    if (usarPersonalizadas) {
      if (modoMetas === 'mensal' && metas.length > 0) {
        const totalLuc = metas.reduce((s, m) => s + Number(m.meta_lucro), 0);
        if (totalLuc > 0) {
          return {
            metaFaturamento: 0,
            metaLucro: totalLuc,
            origem: 'personalizada'
          };
        }
      }
      if (modoMetas === 'categoria' && metasPorCategoria.length > 0) {
        const totalLuc = metasPorCategoria.filter(m => m.mes === 0).reduce((s, m) => s + Number(m.meta_lucro), 0);
        if (totalLuc > 0) {
          return {
            metaFaturamento: 0,
            metaLucro: totalLuc,
            origem: 'personalizada'
          };
        }
      }
    }
    const annual = GoalsIntegrationService.getAnnualGoals();
    return {
      metaFaturamento: annual.revenue,
      metaLucro: annual.profit,
      origem: 'precificacao'
    };
  }, [usarPersonalizadas, modoMetas, metas, metasPorCategoria]);

  return {
    metas,
    metasPorCategoria,
    usarPersonalizadas,
    modoMetas,
    loading,
    toggleUsarPersonalizadas,
    setModoMetas,
    salvarMeta,
    salvarTodasMetas,
    salvarMetaCategoria,
    removerMetaCategoria,
    getMetaParaMes,
    getMetaAnual
  };
}
