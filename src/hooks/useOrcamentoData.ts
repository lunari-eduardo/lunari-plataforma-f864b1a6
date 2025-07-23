import { useMemo } from 'react';
import { useOrcamentos } from './useOrcamentos';

interface ProdutoIncluido {
  produtoId: string;
  quantidade: number;
}

interface MappedPackage {
  id: string;
  nome: string;
  valor: number;
  categoria: string;
  categoriaId?: string;
  produtosIncluidos?: ProdutoIncluido[];
}

interface MappedProduct {
  id: string;
  nome: string;
  valorVenda: number;
  custo?: number;
  categoria?: string;
}

// Utility function to get category name by ID
const getCategoriaNameById = (categoriaId: string | number, configCategorias: any[]): string => {
  if (!categoriaId || !configCategorias.length) return '';
  
  // Try direct match first
  const categoria = configCategorias.find((cat: any) => 
    cat.id === categoriaId || cat.id === String(categoriaId)
  );
  
  if (categoria) {
    return categoria.nome || String(categoriaId);
  }
  
  // Fallback: try index-based lookup (1-based indexing)
  const index = parseInt(String(categoriaId)) - 1;
  if (index >= 0 && index < configCategorias.length) {
    return configCategorias[index].nome || String(categoriaId);
  }
  
  return String(categoriaId);
};

export function useOrcamentoData() {
  const { pacotes, produtos, categorias } = useOrcamentos();

  // Get raw configuration categories for ID resolution
  const configCategorias = useMemo(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('configuracoes_categorias');
      return stored ? JSON.parse(stored) : [];
    }
    return [];
  }, []);

  // Mapear categorias - podem ser strings ou objetos
  const mappedCategorias = useMemo(() => {
    if (!categorias || categorias.length === 0) return [];
    
    // Se categorias for array de strings, retorna como está
    if (typeof categorias[0] === 'string') {
      return categorias as string[];
    }
    
    // Se for array de objetos, extrai os nomes
    const categoriasObjs = categorias.filter((cat: any) => cat && typeof cat === 'object' && cat.nome);
    return categoriasObjs.map((cat: any) => cat.nome);
  }, [categorias]);

  // Mapear pacotes para formato consistente com resolução correta de categoria
  const mappedPacotes = useMemo((): MappedPackage[] => {
    console.log('Pacotes recebidos:', pacotes); // Debug
    return (pacotes || []).map(pacote => {
      // Buscar categoria pelo ID usando a função utilitária
      let categoria = pacote.categoria || '';
      if (pacote.categoria_id) {
        categoria = getCategoriaNameById(pacote.categoria_id, configCategorias);
      }

      return {
        id: pacote.id,
        nome: pacote.nome,
        valor: pacote.valorVenda || pacote.valor_base || pacote.valor || 0,
        categoria,
        categoriaId: pacote.categoria_id,
        produtosIncluidos: pacote.produtosIncluidos || []
      };
    });
  }, [pacotes, configCategorias]);

  // Mapear produtos para formato consistente
  const mappedProdutos = useMemo((): MappedProduct[] => {
    console.log('Produtos recebidos:', produtos); // Debug
    return (produtos || []).map(produto => ({
      id: produto.id,
      nome: produto.nome,
      valorVenda: produto.valorVenda || produto.preco_venda || produto.valor || 0,
      custo: produto.custo || produto.preco_custo || 0,
      categoria: produto.categoria || ''
    }));
  }, [produtos]);

  console.log('Dados mapeados:', { 
    categorias: mappedCategorias, 
    pacotes: mappedPacotes, 
    produtos: mappedProdutos 
  }); // Debug

  return {
    pacotes: mappedPacotes,
    produtos: mappedProdutos,
    categorias: mappedCategorias,
    getCategoriaNameById: (id: string | number) => getCategoriaNameById(id, configCategorias)
  };
}