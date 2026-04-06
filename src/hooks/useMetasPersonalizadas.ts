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

        const { data: config, error: configError } = await supabase
          .from('pricing_configuracoes')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle();

        if (configError) {
          console.error('Erro ao carregar config de metas:', configError);
        }

        setUsarPersonalizadasState(config?.usar_metas_personalizadas ?? false);
        setModoMetasState(config?.modo_metas as 'mensal' | 'categoria' ?? 'mensal');

        const { data: metasData, error: metasError } = await supabase
          .from('metas_personalizadas')
          .select('*')
          .eq('user_id', user.id)
          .eq('ano', ano)
          .order('mes');

        if (metasError) {
          console.error('Erro ao carregar metas personalizadas:', metasError);
        }

        const all = metasData || [];
        console.log('[Metas] Dados carregados:', all.length, 'registros para ano', ano);
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
    const { error } = await supabase
      .from('pricing_configuracoes')
      .update({ usar_metas_personalizadas: valor })
      .eq('user_id', user.id);
    if (error) {
      console.error('Erro ao toggle metas personalizadas:', error);
      return;
    }
    setUsarPersonalizadasState(valor);
  }, []);

  const setModoMetas = useCallback(async (modo: 'mensal' | 'categoria') => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase
      .from('pricing_configuracoes')
      .update({ modo_metas: modo } as any)
      .eq('user_id', user.id);
    if (error) {
      console.error('Erro ao alterar modo de metas:', error);
      return;
    }
    setModoMetasState(modo);
  }, []);

  const salvarMeta = useCallback(async (mes: number, metaFaturamento: number, metaLucro: number) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from('metas_personalizadas')
      .upsert({
        user_id: user.id,
        ano,
        mes,
        meta_faturamento: metaFaturamento,
        meta_lucro: metaLucro,
        categoria: '__geral__'
      }, {
        onConflict: 'user_id,ano,mes,categoria'
      })
      .select()
      .single();

    if (error) {
      console.error('[Metas] Erro ao salvar meta mensal:', error);
    } else {
      console.log('[Metas] Meta mensal salva:', data);
      setMetas(prev => {
        const existing = prev.findIndex(m => m.mes === mes);
        if (existing >= 0) {
          const updated = [...prev];
          updated[existing] = data;
          return updated;
        }
        return [...prev, data].sort((a, b) => a.mes - b.mes);
      });
    }
    return { data, error };
  }, [ano]);

  const salvarTodasMetas = useCallback(async (metasArray: { mes: number; meta_faturamento: number; meta_lucro: number }[]) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { data: null, error: { message: 'Usuário não autenticado' } };

    const rows = metasArray.map(m => ({
      user_id: user.id,
      ano,
      mes: m.mes,
      meta_faturamento: m.meta_faturamento,
      meta_lucro: m.meta_lucro,
      categoria: '__geral__'
    }));

    console.log('[Metas] Salvando todas metas mensais:', rows);

    const { data, error } = await supabase
      .from('metas_personalizadas')
      .upsert(rows, { onConflict: 'user_id,ano,mes,categoria' })
      .select();

    if (error) {
      console.error('[Metas] Erro ao salvar todas metas:', error);
    } else {
      console.log('[Metas] Todas metas salvas:', data?.length, 'registros');
      setMetas((data || []).filter(m => m.categoria === '__geral__').sort((a, b) => a.mes - b.mes));
    }
    return { data, error };
  }, [ano]);

  const salvarMetaCategoria = useCallback(async (mes: number, categoriaId: string, metaFaturamento: number, metaLucro: number) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { data: null, error: { message: 'Usuário não autenticado' } };

    console.log('[Metas] Salvando meta por categoria:', { mes, categoriaId, metaFaturamento });

    const { data, error } = await supabase
      .from('metas_personalizadas')
      .upsert({
        user_id: user.id,
        ano,
        mes,
        meta_faturamento: metaFaturamento,
        meta_lucro: metaLucro,
        categoria: categoriaId
      }, {
        onConflict: 'user_id,ano,mes,categoria'
      })
      .select()
      .single();

    if (error) {
      console.error('[Metas] Erro ao salvar meta por categoria:', error);
    } else {
      console.log('[Metas] Meta por categoria salva:', data);
      setMetasPorCategoria(prev => {
        const idx = prev.findIndex(m => m.mes === mes && m.categoria === categoriaId);
        if (idx >= 0) {
          const updated = [...prev];
          updated[idx] = data;
          return updated;
        }
        return [...prev, data];
      });
    }
    return { data, error };
  }, [ano]);

  const removerMetaCategoria = useCallback(async (mes: number, categoriaId: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from('metas_personalizadas')
      .delete()
      .eq('user_id', user.id)
      .eq('ano', ano)
      .eq('mes', mes)
      .eq('categoria', categoriaId);

    if (error) {
      console.error('[Metas] Erro ao remover meta por categoria:', error);
      return;
    }

    setMetasPorCategoria(prev => prev.filter(m => !(m.mes === mes && m.categoria === categoriaId)));
  }, [ano]);

  const getMetaParaMes = useCallback((mes: number): MetaResolvidaParaPeriodo => {
    if (usarPersonalizadas) {
      if (modoMetas === 'mensal') {
        const metaCustom = metas.find(m => m.mes === mes);
        if (metaCustom && metaCustom.meta_faturamento > 0) {
          return {
            metaFaturamento: metaCustom.meta_faturamento,
            metaLucro: 0,
            origem: 'personalizada'
          };
        }
      }
    }
    const annual = GoalsIntegrationService.getAnnualGoals();
    return {
      metaFaturamento: annual.revenue / 12,
      metaLucro: 0,
      origem: 'precificacao'
    };
  }, [usarPersonalizadas, modoMetas, metas]);

  const getMetaParaCategoria = useCallback((categoriaName: string): MetaResolvidaParaPeriodo => {
    if (usarPersonalizadas && modoMetas === 'categoria') {
      const metaCat = metasPorCategoria.find(m => m.categoria === categoriaName && m.mes === 0);
      if (metaCat && metaCat.meta_faturamento > 0) {
        return {
          metaFaturamento: metaCat.meta_faturamento,
          metaLucro: 0,
          origem: 'personalizada'
        };
      }
    }
    return {
      metaFaturamento: 0,
      metaLucro: 0,
      origem: 'precificacao'
    };
  }, [usarPersonalizadas, modoMetas, metasPorCategoria]);

  const getMetaAnual = useCallback((): MetaResolvidaParaPeriodo => {
    // Visão "ano todo" sempre usa meta da precificação (referência base do negócio)
    const annual = GoalsIntegrationService.getAnnualGoals();
    return {
      metaFaturamento: annual.revenue,
      metaLucro: 0,
      origem: 'precificacao'
    };
  }, []);

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
    getMetaAnual,
    getMetaParaCategoria
  };
}
