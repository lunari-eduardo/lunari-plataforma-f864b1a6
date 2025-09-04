// Compatibility hook - budget system removed
import { useAppContext } from '@/contexts/AppContext';

export function useOrcamentoData() {
  const { pacotes, produtos, categorias } = useAppContext();

  return {
    pacotes: pacotes || [],
    produtos: produtos || [],
    categorias: categorias || [],
    getCategoriaNameById: (id: string | number) => String(id)
  };
}