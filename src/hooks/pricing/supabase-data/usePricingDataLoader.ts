import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { SupabasePricingAdapter } from '@/services/pricing/SupabasePricingAdapter';
import { PricingMigrationToSupabase } from '@/services/pricing/PricingMigrationToSupabase';
import { MetasService } from '@/services/PricingService';
import { toast } from 'sonner';
import type {
  EstruturaCustosFixos,
  MetasPrecificacao,
  PadraoHoras,
  StatusSalvamento,
} from '@/types/precificacao';
import { pricingCache, isCacheValid, invalidatePricingCache } from './pricingCache';

interface UsePricingDataLoaderProps {
  adapterRef: React.MutableRefObject<SupabasePricingAdapter>;
  setStatusSalvamento: (status: StatusSalvamento) => void;
  setEstruturaCustos: React.Dispatch<React.SetStateAction<EstruturaCustosFixos | null>>;
  setMetas: React.Dispatch<React.SetStateAction<MetasPrecificacao | null>>;
  setPadraoHoras: React.Dispatch<React.SetStateAction<PadraoHoras | null>>;
  setLoading: React.Dispatch<React.SetStateAction<boolean>>;
}

export const usePricingDataLoader = ({
  adapterRef,
  setStatusSalvamento,
  setEstruturaCustos,
  setMetas,
  setPadraoHoras,
  setLoading,
}: UsePricingDataLoaderProps) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const loadAllDataRef = useRef<() => Promise<void>>();
  const realtimeDebounceRef = useRef<NodeJS.Timeout | null>(null);

  const loadAllData = useCallback(async () => {
    if (pricingCache.estruturaCustos) {
      setEstruturaCustos(pricingCache.estruturaCustos);
      setMetas(pricingCache.metas);
      setPadraoHoras(pricingCache.padraoHoras);
      setLoading(false);

      if (isCacheValid()) {
        console.log('📦 Cache válido, usando dados existentes');
        return;
      }

      console.log('🔄 Atualizando dados em background...');
    }

    if (pricingCache.isLoading) {
      console.log('⏳ Já está carregando dados de precificação...');
      return;
    }

    pricingCache.isLoading = true;

    if (!pricingCache.estruturaCustos) {
      setLoading(true);
    }

    const timeoutId = setTimeout(() => {
      console.warn('⚠️ Timeout no carregamento de dados de precificação');
      setLoading(false);
      setStatusSalvamento('erro');
      pricingCache.isLoading = false;
    }, 5000);

    try {
      const estrutura = await adapterRef.current.loadEstruturaCustos();
      setEstruturaCustos(estrutura);
      pricingCache.estruturaCustos = estrutura;
      setLoading(false);

      const [metasData, horasData] = await Promise.all([
        adapterRef.current.loadMetas(),
        adapterRef.current.loadPadraoHoras(),
      ]);

      setMetas(metasData);
      setPadraoHoras(horasData);

      pricingCache.metas = metasData;
      pricingCache.padraoHoras = horasData;
      pricingCache.lastFetch = Date.now();
      pricingCache.hasLoadedOnce = true;

      if (metasData) {
        MetasService.salvar(metasData);
        console.log('✅ Metas sincronizadas com localStorage');
      }

      setStatusSalvamento('salvo');
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      setStatusSalvamento('erro');
      setLoading(false);
    } finally {
      clearTimeout(timeoutId);
      pricingCache.isLoading = false;
    }
  }, [adapterRef, setEstruturaCustos, setMetas, setPadraoHoras, setLoading, setStatusSalvamento]);

  loadAllDataRef.current = loadAllData;

  const loadEstruturaCustos = useCallback(async () => {
    try {
      const estrutura = await adapterRef.current.loadEstruturaCustos();
      setEstruturaCustos(estrutura);
      pricingCache.estruturaCustos = estrutura;
    } catch (error) {
      console.error('Erro ao recarregar estrutura:', error);
    }
  }, [adapterRef, setEstruturaCustos]);

  const handleRealtimeChange = useCallback(() => {
    if (realtimeDebounceRef.current) {
      clearTimeout(realtimeDebounceRef.current);
    }

    realtimeDebounceRef.current = setTimeout(() => {
      console.log('🔄 Realtime: recarregando dados...');
      invalidatePricingCache();
      loadAllDataRef.current?.();
    }, 1000);
  }, []);

  // Inicialização e Auth listener
  useEffect(() => {
    const initialize = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          setIsAuthenticated(false);
          setLoading(false);
          return;
        }

        setIsAuthenticated(true);

        const needsMigration = await PricingMigrationToSupabase.needsMigration();
        if (needsMigration) {
          const result = await PricingMigrationToSupabase.executeMigration();
          if (result.success) {
            toast.success('Dados de precificação migrados para a nuvem');
            invalidatePricingCache();
          }
        }

        await loadAllData();
      } catch (error) {
        console.error('Erro na inicialização:', error);
        setLoading(false);
      }
    };

    initialize();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        setIsAuthenticated(true);
        invalidatePricingCache();
        pricingCache.hasLoadedOnce = false;
        await loadAllData();
      } else if (event === 'SIGNED_OUT') {
        setIsAuthenticated(false);
        setEstruturaCustos(null);
        setMetas(null);
        setPadraoHoras(null);
        invalidatePricingCache();
        pricingCache.hasLoadedOnce = false;
      }
    });

    return () => subscription.unsubscribe();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Realtime listeners das tabelas de pricing
  useEffect(() => {
    if (!isAuthenticated) return;

    let channel: ReturnType<typeof supabase.channel> | null = null;
    let isMounted = true;

    const setupRealtimeListeners = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user || !isMounted) return;

      channel = supabase
        .channel('pricing-changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'pricing_configuracoes',
            filter: `user_id=eq.${user.id}`,
          },
          () => {
            if (isMounted) handleRealtimeChange();
          },
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'pricing_gastos_pessoais',
            filter: `user_id=eq.${user.id}`,
          },
          () => {
            if (isMounted) handleRealtimeChange();
          },
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'pricing_custos_estudio',
            filter: `user_id=eq.${user.id}`,
          },
          () => {
            if (isMounted) handleRealtimeChange();
          },
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'pricing_equipamentos',
            filter: `user_id=eq.${user.id}`,
          },
          () => {
            if (isMounted) handleRealtimeChange();
          },
        )
        .subscribe();
    };

    setupRealtimeListeners();

    return () => {
      isMounted = false;
      if (realtimeDebounceRef.current) {
        clearTimeout(realtimeDebounceRef.current);
      }
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [isAuthenticated, handleRealtimeChange]);

  return {
    isAuthenticated,
    loadAllData,
    loadEstruturaCustos,
  };
};
