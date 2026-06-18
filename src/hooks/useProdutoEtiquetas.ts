/**
 * Wrapper de compatibilidade: delega para o ProdutoEtiquetasContext.
 * Mantém a mesma assinatura usada por consumidores legados.
 */
import { useProdutoEtiquetasContext, type ProdutoEtiquetasContextValue } from '@/contexts/ProdutoEtiquetasContext';

export type UseProdutoEtiquetasReturn = ProdutoEtiquetasContextValue;

export function useProdutoEtiquetas(): UseProdutoEtiquetasReturn {
  return useProdutoEtiquetasContext();
}
