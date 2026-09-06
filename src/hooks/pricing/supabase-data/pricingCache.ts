import type {
  EstruturaCustosFixos,
  MetasPrecificacao,
  PadraoHoras,
  StatusSalvamento,
} from '@/types/precificacao';

// ============= SINGLETON CACHE =============
// Persiste entre navegações de página
export const pricingCache = {
  estruturaCustos: null as EstruturaCustosFixos | null,
  metas: null as MetasPrecificacao | null,
  padraoHoras: null as PadraoHoras | null,
  lastFetch: 0,
  isLoading: false,
  hasLoadedOnce: false, // Nova flag: já carregou pelo menos uma vez
  statusSalvamento: 'salvo' as StatusSalvamento, // Persistir status no cache
  CACHE_TTL: 5 * 60 * 1000, // 5 minutos
};

// Verificar se cache ainda é válido
export const isCacheValid = (): boolean => {
  return (
    pricingCache.lastFetch > 0 &&
    Date.now() - pricingCache.lastFetch < pricingCache.CACHE_TTL
  );
};

// Invalidar cache (para forçar reload)
export const invalidatePricingCache = (): void => {
  pricingCache.lastFetch = 0;
};
