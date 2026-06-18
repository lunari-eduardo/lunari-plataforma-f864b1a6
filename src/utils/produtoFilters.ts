import type { Produto } from '@/types/configuration';
import { normalizeString } from '@/utils/stringNormalization';

export interface ProdutoFilterCriteria {
  query?: string;
  etiquetaIds?: string[];      // AND: produto precisa ter todas
  onlyFavoritos?: boolean;
}

export function filterProdutos<T extends Produto>(
  produtos: T[],
  criteria: ProdutoFilterCriteria
): T[] {
  const { query, etiquetaIds, onlyFavoritos } = criteria;
  const normalizedQuery = query ? normalizeString(query) : '';

  return produtos.filter(p => {
    if (onlyFavoritos && !p.favorito) return false;

    if (normalizedQuery) {
      const nome = normalizeString(p.nome ?? '');
      if (!nome.includes(normalizedQuery)) return false;
    }

    if (etiquetaIds && etiquetaIds.length > 0) {
      const ids = new Set((p.etiquetas ?? []).map(e => e.id));
      for (const id of etiquetaIds) {
        if (!ids.has(id)) return false;
      }
    }

    return true;
  });
}
