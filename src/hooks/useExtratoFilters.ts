/**
 * Hook para gerenciamento de filtros do extrato
 * Estado dos filtros separado da aplicação client-side, para permitir que
 * filtros server-side (tipo/origem/status) alimentem a query.
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

/**
 * Hook que mantém apenas o estado dos filtros e preferências.
 * Não aplica filtros — isso é feito por useExtratoFiltersApply.
 */
export function useExtratoFiltersState() {
  const [preferencias, setPreferencias] = useState<PreferenciasExtrato>(() => {
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

  useEffect(() => {
    storage.save(PREFERENCIAS_STORAGE_KEY, preferencias);
  }, [preferencias]);

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
    atualizarFiltros,
    atualizarPreferencias,
    limparFiltros
  };
}

/**
 * Aplica filtros client-side (busca/cliente/ordenação) sobre as linhas dadas.
 * Filtros server-side (tipo/origem/status/período) já vieram aplicados da query.
 */
export function aplicarFiltrosClientSide(
  linhasExtrato: LinhaExtrato[],
  filtros: FiltrosExtrato,
  preferencias: PreferenciasExtrato
): LinhaExtrato[] {
  let resultado = [...linhasExtrato];

  // Período (defensivo — já filtrado server-side, mas mantém consistência)
  resultado = aplicarFiltrosPeriodo(resultado, filtros.dataInicio, filtros.dataFim);

  // Tipo/origem/status já são server-side, mas reaplicar é idempotente e barato
  if (filtros.tipo && filtros.tipo !== 'todos') {
    resultado = resultado.filter(l => l.tipo === filtros.tipo);
  }
  if (filtros.origem && filtros.origem !== 'todos') {
    resultado = resultado.filter(l => l.origem === filtros.origem);
  }
  if (filtros.status && filtros.status !== 'todos') {
    resultado = resultado.filter(l => l.status === filtros.status);
  }

  if (filtros.cliente) {
    resultado = resultado.filter(l =>
      l.cliente?.toLowerCase().includes(filtros.cliente!.toLowerCase())
    );
  }

  resultado = aplicarFiltrosBusca(resultado, filtros.busca || '');
  resultado = ordenarLinhas(resultado, preferencias.ordenacao.campo, preferencias.ordenacao.direcao);

  return resultado;
}

/**
 * Hook legado — combina estado + aplicação. Mantido para compatibilidade.
 */
export function useExtratoFilters(linhasExtrato: LinhaExtrato[]) {
  const state = useExtratoFiltersState();

  const linhasFiltradas = useMemo(
    () => aplicarFiltrosClientSide(linhasExtrato, state.filtros, state.preferencias),
    [linhasExtrato, state.filtros, state.preferencias]
  );

  return {
    ...state,
    linhasFiltradas
  };
}
