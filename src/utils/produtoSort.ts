import type { Produto } from '@/types/configuration';

/**
 * Ordena produtos: favoritos primeiro (mais recentes no topo), depois alfabético PT-BR.
 */
export function sortProdutos<T extends Pick<Produto, 'nome' | 'favorito' | 'favorited_at'>>(
  a: T,
  b: T
): number {
  const fa = a.favorito ? 1 : 0;
  const fb = b.favorito ? 1 : 0;
  if (fa !== fb) return fb - fa;

  if (a.favorito && b.favorito) {
    const ta = a.favorited_at ?? '';
    const tb = b.favorited_at ?? '';
    if (ta !== tb) return tb.localeCompare(ta);
  }

  return (a.nome ?? '').localeCompare(b.nome ?? '', 'pt-BR', { sensitivity: 'base' });
}

export function sortProdutosArray<T extends Pick<Produto, 'nome' | 'favorito' | 'favorited_at'>>(
  produtos: T[]
): T[] {
  return [...produtos].sort(sortProdutos);
}
