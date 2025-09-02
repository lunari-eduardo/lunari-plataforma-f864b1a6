/**
 * Hook especializado para gestão de produtos
 * Centraliza lógica de produtos com otimizações de performance
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { toast } from 'sonner';
import { configurationService } from '@/services/ConfigurationService';
import { calcularMargemLucro, validarProduto } from '@/utils/productUtils';
import type { Produto, Pacote } from '@/types/configuration';

interface UseProdutosReturn {
  // Estado
  produtos: Produto[];
  isLoading: boolean;
  
  // Operações CRUD
  adicionarProduto: (produto: Omit<Produto, 'id'>) => void;
  atualizarProduto: (id: string, dados: Partial<Produto>) => void;
  removerProduto: (id: string) => void;
  
  // Utilitários
  calcularMargemProduto: (custo: number, venda: number) => ReturnType<typeof calcularMargemLucro>;
  validarDadosProduto: (produto: Omit<Produto, 'id'>) => { valid: boolean; error?: string };
  podeRemoverProduto: (id: string) => boolean;
}

export function useProdutos(pacotes: Pacote[] = []): UseProdutosReturn {
  // ============= ESTADO =============
  
  const [produtos, setProdutos] = useState<Produto[]>(() => 
    configurationService.loadProdutos()
  );
  
  const [isLoading, setIsLoading] = useState(false);

  // ============= PERSISTÊNCIA =============
  
  useEffect(() => {
    configurationService.saveProdutos(produtos);
  }, [produtos]);

  // ============= OPERAÇÕES CRUD =============
  
  const adicionarProduto = useCallback((produto: Omit<Produto, 'id'>) => {
    const validation = validarProduto(produto);
    if (!validation.valid) {
      toast.error(validation.error);
      return;
    }

    setIsLoading(true);
    
    try {
      const novoProduto: Produto = {
        ...produto,
        id: configurationService.generateId(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      setProdutos(prev => [...prev, novoProduto]);
      toast.success('Produto adicionado com sucesso!');
    } catch (error) {
      console.error('Erro ao adicionar produto:', error);
      toast.error('Erro ao adicionar produto');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const atualizarProduto = useCallback((id: string, dados: Partial<Produto>) => {
    setIsLoading(true);
    
    try {
      setProdutos(prev => prev.map(produto => 
        produto.id === id 
          ? { 
              ...produto, 
              ...dados, 
              updated_at: new Date().toISOString() 
            } 
          : produto
      ));
      toast.success('Produto atualizado com sucesso!');
    } catch (error) {
      console.error('Erro ao atualizar produto:', error);
      toast.error('Erro ao atualizar produto');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const removerProduto = useCallback((id: string) => {
    if (!configurationService.canDeleteProduto(id, pacotes)) {
      toast.error('Este produto não pode ser removido pois está sendo usado em pacotes');
      return;
    }

    setIsLoading(true);
    
    try {
      setProdutos(prev => prev.filter(produto => produto.id !== id));
      toast.success('Produto removido com sucesso!');
    } catch (error) {
      console.error('Erro ao remover produto:', error);
      toast.error('Erro ao remover produto');
    } finally {
      setIsLoading(false);
    }
  }, [pacotes]);

  // ============= UTILITÁRIOS MEMOIZADOS =============
  
  const calcularMargemProduto = useCallback((custo: number, venda: number) => {
    return calcularMargemLucro(custo, venda);
  }, []);

  const validarDadosProduto = useCallback((produto: Omit<Produto, 'id'>) => {
    return validarProduto(produto);
  }, []);

  const podeRemoverProduto = useCallback((id: string) => {
    return configurationService.canDeleteProduto(id, pacotes);
  }, [pacotes]);

  // ============= RETORNO =============
  
  return {
    // Estado
    produtos,
    isLoading,
    
    // Operações CRUD
    adicionarProduto,
    atualizarProduto,
    removerProduto,
    
    // Utilitários
    calcularMargemProduto,
    validarDadosProduto,
    podeRemoverProduto
  };
}