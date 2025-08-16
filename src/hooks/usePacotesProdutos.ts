import { useState, useEffect } from 'react';

interface Produto {
  id: string;
  nome: string;
  valorVenda?: number;
  preco_venda?: number;
  valor?: number;
  custo?: number;
  preco_custo?: number;
  categoria?: string;
}

interface Pacote {
  id: string;
  nome: string;
  categoria?: string;
  categoria_id?: string;
  valorVenda?: number;
  valor_base?: number;
  valor?: number;
  valor_foto_extra?: number;
  produtosIncluidos?: Array<{
    produtoId: string;
    quantidade: number;
  }>;
}

export const usePacotesProdutos = () => {
  const [produtos, setProdutos] = useState<Produto[]>(() => {
    try {
      const stored = localStorage.getItem('configuracoes_produtos');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const [pacotes, setPacotes] = useState<Pacote[]>(() => {
    try {
      const stored = localStorage.getItem('configuracoes_pacotes');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const [categorias, setCategorias] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem('configuracoes_categorias');
      const configCategorias = stored ? JSON.parse(stored) : [];
      return configCategorias.map((cat: any) => cat.nome || cat);
    } catch {
      return [];
    }
  });

  // Salvar no localStorage sempre que os dados mudarem
  useEffect(() => {
    localStorage.setItem('configuracoes_produtos', JSON.stringify(produtos));
  }, [produtos]);

  useEffect(() => {
    localStorage.setItem('configuracoes_pacotes', JSON.stringify(pacotes));
  }, [pacotes]);

  const adicionarCategoria = (categoria: string): void => {
    if (!categorias.includes(categoria)) {
      const novasCategorias = [...categorias, categoria];
      setCategorias(novasCategorias);
      
      // Atualizar localStorage das categorias também
      const configCategorias = novasCategorias.map(nome => ({ nome }));
      localStorage.setItem('configuracoes_categorias', JSON.stringify(configCategorias));
    }
  };

  const removerCategoria = (categoria: string): void => {
    const novasCategorias = categorias.filter(cat => cat !== categoria);
    setCategorias(novasCategorias);
    
    // Atualizar localStorage das categorias também
    const configCategorias = novasCategorias.map(nome => ({ nome }));
    localStorage.setItem('configuracoes_categorias', JSON.stringify(configCategorias));
  };

  return {
    produtos,
    pacotes,
    categorias,
    setProdutos,
    setPacotes,
    adicionarCategoria,
    removerCategoria
  };
};