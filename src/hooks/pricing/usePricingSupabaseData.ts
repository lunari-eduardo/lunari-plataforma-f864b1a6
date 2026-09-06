/**
 * Hook para gerenciar dados de Pricing via Supabase
 * Com cache em memória e sincronização localStorage
 */

import { useState, useCallback, useRef } from 'react';
import { SupabasePricingAdapter } from '@/services/pricing/SupabasePricingAdapter';
import type {
  EstruturaCustosFixos,
  MetasPrecificacao,
  PadraoHoras,
  StatusSalvamento,
} from '@/types/precificacao';

import {
  pricingCache,
  invalidatePricingCache,
} from './supabase-data/pricingCache';
import {
  calcularTotalEstrutura,
  calcularCustosFixosHora,
} from './supabase-data/pricingCalculations';
import { usePricingDataLoader } from './supabase-data/usePricingDataLoader';
import { usePricingMutations } from './supabase-data/usePricingMutations';

export { invalidatePricingCache };

export function usePricingSupabaseData() {
  const [estruturaCustos, setEstruturaCustos] = useState<EstruturaCustosFixos | null>(
    pricingCache.estruturaCustos,
  );
  const [metas, setMetas] = useState<MetasPrecificacao | null>(pricingCache.metas);
  const [padraoHoras, setPadraoHoras] = useState<PadraoHoras | null>(pricingCache.padraoHoras);

  const [loading, setLoading] = useState(
    !pricingCache.hasLoadedOnce && !pricingCache.estruturaCustos,
  );

  const [statusSalvamento, setStatusSalvamentoLocal] = useState<StatusSalvamento>(
    pricingCache.statusSalvamento,
  );

  const adapterRef = useRef(new SupabasePricingAdapter());

  const setStatusSalvamento = useCallback((status: StatusSalvamento) => {
    setStatusSalvamentoLocal(status);
    pricingCache.statusSalvamento = status;
  }, []);

  const { isAuthenticated, loadAllData } = usePricingDataLoader({
    adapterRef,
    setStatusSalvamento,
    setEstruturaCustos,
    setMetas,
    setPadraoHoras,
    setLoading,
  });

  const {
    flushPendingSave,
    adicionarGastoPessoal,
    removerGastoPessoal,
    atualizarGastoPessoal,
    adicionarCustoEstudio,
    removerCustoEstudio,
    atualizarCustoEstudio,
    adicionarEquipamento,
    removerEquipamento,
    atualizarEquipamento,
    atualizarPercentualProLabore,
    salvarEstruturaCustos,
    atualizarMetas,
    atualizarMargemLucro,
  } = usePricingMutations({
    adapterRef,
    estruturaCustos,
    setEstruturaCustos,
    metas,
    setMetas,
    setStatusSalvamento,
  });

  const calcularTotal = useCallback((dados: EstruturaCustosFixos): number => {
    return calcularTotalEstrutura(dados);
  }, []);

  const totalCustosFixos = estruturaCustos ? calcularTotal(estruturaCustos) : 0;
  const custosFixosHora = calcularCustosFixosHora(totalCustosFixos, padraoHoras);

  return {
    // Estado
    estruturaCustos,
    metas,
    padraoHoras,
    loading,
    statusSalvamento,
    isAuthenticated,

    // Valores calculados
    totalCustosFixos,
    custosFixosHora,

    // Ações de estrutura
    adicionarGastoPessoal,
    removerGastoPessoal,
    atualizarGastoPessoal,
    adicionarCustoEstudio,
    removerCustoEstudio,
    atualizarCustoEstudio,
    adicionarEquipamento,
    removerEquipamento,
    atualizarEquipamento,
    atualizarPercentualProLabore,
    salvarEstruturaCustos,

    // Ações de metas
    atualizarMetas,
    atualizarMargemLucro,

    // Utilitários
    recarregar: loadAllData,
    calcularTotal,
    flushPendingSave,
  };
}
