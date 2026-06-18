import type { Produto } from '@/types/configuration';

/**
 * Ordena produtos: favoritos primeiro, depois alfabético PT-BR (case-insensitive, numérico).
 * Dentro de cada bloco (favoritos / não-favoritos) a ordenação é puramente por nome.
 */
export function sortProdutos<T extends Pick<Produto, 'nome' | 'favorito'>>(
  a: T,
  b: T
): number {
  const fa = a.favorito ? 1 : 0;
  const fb = b.favorito ? 1 : 0;
  if (fa !== fb) return fb - fa;
  return (a.nome ?? '').localeCompare(b.nome ?? '', 'pt-BR', {
    sensitivity: 'base',
    numeric: true,
  });
}

export function sortProdutosArray<T extends Pick<Produto, 'nome' | 'favorito'>>(
  produtos: T[]
): T[] {
  return [...produtos].sort(sortProdutos);
}
