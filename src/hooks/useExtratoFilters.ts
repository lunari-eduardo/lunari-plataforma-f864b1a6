/**
 * Hook para gerenciamento de filtros do extrato
 */

import { useState, useMemo, useCallback, useEffect } from 'react';
import { FiltrosExtrato, PreferenciasExtrato, LinhaExtrato } from '@/types/extrato';
import { storage } from '@/utils/localStorage';
import { 
  PREFERENCIAS_STORAGE_KEY, 
  PREFERENCIAS_DEFAULT 
} from '@/constants/extratoConstants';
import { 
  getDefaultPeriod, 
  aplicarFiltrosPeriodo,
  aplicarFiltrosBusca,
  ordenarLinhas
} from '@/utils/extratoUtils';

export function useExtratoFilters(linhasExtrato: LinhaExtrato[]) {
  // ============= ESTADOS =============
  const [preferencias, setPreferencias] = useState<PreferenciasExtrato>(() => {
    // TODO: [SUPABASE] Migrar para user_preferences table
    return storage.load(PREFERENCIAS_STORAGE_KEY, PREFERENCIAS_DEFAULT);
  });

  const [filtros, setFiltros] = useState<FiltrosExtrato>(() => {
    const { inicioMes, fimMes } = getDefaultPeriod();
    
    return {
      dataInicio: inicioMes,
      dataFim: fimMes,
      ...preferencias.filtrosDefault
    };
  });

  // ============= PERSISTÊNCIA DE PREFERÊNCIAS =============
  useEffect(() => {
    // TODO: [SUPABASE] Salvar em user_preferences com debounce
    storage.save(PREFERENCIAS_STORAGE_KEY, preferencias);
  }, [preferencias]);

  // ============= APLICAÇÃO DE FILTROS =============
  const linhasFiltradas = useMemo(() => {
    let resultado = [...linhasExtrato];

    // Filtro por período
    resultado = aplicarFiltrosPeriodo(resultado, filtros.dataInicio, filtros.dataFim);

    // Filtro por tipo
    if (filtros.tipo && filtros.tipo !== 'todos') {
      resultado = resultado.filter(linha => linha.tipo === filtros.tipo);
    }

    // Filtro por origem
    if (filtros.origem && filtros.origem !== 'todos') {
      resultado = resultado.filter(linha => linha.origem === filtros.origem);
    }

    // Filtro por status
    if (filtros.status && filtros.status !== 'todos') {
      resultado = resultado.filter(linha => linha.status === filtros.status);
    }

    // Filtro por cliente
    if (filtros.cliente) {
      resultado = resultado.filter(linha => 
        linha.cliente?.toLowerCase().includes(filtros.cliente!.toLowerCase())
      );
    }

    // Filtro por busca geral
    resultado = aplicarFiltrosBusca(resultado, filtros.busca || '');

    // Aplicar ordenação
    resultado = ordenarLinhas(
      resultado, 
      preferencias.ordenacao.campo, 
      preferencias.ordenacao.direcao
    );

    return resultado;
  }, [linhasExtrato, filtros, preferencias.ordenacao]);

  // ============= FUNÇÕES DE CONTROLE =============
  const atualizarFiltros = useCallback((novosFiltros: Partial<FiltrosExtrato>) => {
    setFiltros(prev => ({ ...prev, ...novosFiltros }));
  }, []);

  const atualizarPreferencias = useCallback((novasPreferencias: Partial<PreferenciasExtrato>) => {
    setPreferencias(prev => ({ ...prev, ...novasPreferencias }));
  }, []);

  const limparFiltros = useCallback(() => {
    const { inicioMes, fimMes } = getDefaultPeriod();
    
    setFiltros({
      dataInicio: inicioMes,
      dataFim: fimMes,
      ...preferencias.filtrosDefault
    });
  }, [preferencias.filtrosDefault]);

  return {
    filtros,
    preferencias,
    linhasFiltradas,
    atualizarFiltros,
    atualizarPreferencias,
    limparFiltros
  };
}