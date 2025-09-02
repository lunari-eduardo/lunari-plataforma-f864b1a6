/**
 * Hook especializado para gestão de categorias
 * Encapsula toda lógica relacionada a categorias com otimizações e validações
 */

import { useState, useCallback, useMemo } from 'react';
import { toast } from 'sonner';
import { useConfiguration } from '@/hooks/useConfiguration';
import type { Categoria } from '@/types/configuration';

interface EditingState {
  id: string | null;
  originalData: { nome: string; cor: string } | null;
}

interface ValidationResult {
  isValid: boolean;
  error?: string;
}

export function useCategorias() {
  const {
    categorias,
    pacotes,
    adicionarCategoria: addCategory,
    atualizarCategoria: updateCategory,
    removerCategoria: deleteCategory
  } = useConfiguration();

  // Estados locais para interface de edição
  const [editingState, setEditingState] = useState<EditingState>({
    id: null,
    originalData: null
  });
  const [isLoading, setIsLoading] = useState(false);

  // Validação de categoria
  const validateCategoria = useCallback((nome: string, cor: string): ValidationResult => {
    if (!nome.trim()) {
      return { isValid: false, error: 'O nome da categoria é obrigatório' };
    }
    
    if (nome.trim().length < 2) {
      return { isValid: false, error: 'O nome deve ter pelo menos 2 caracteres' };
    }
    
    if (!cor) {
      return { isValid: false, error: 'Selecione uma cor para a categoria' };
    }
    
    // Verifica se já existe uma categoria com o mesmo nome (exceto a que está sendo editada)
    const nomeExists = categorias.some(cat => 
      cat.nome.toLowerCase() === nome.trim().toLowerCase() && 
      cat.id !== editingState.id
    );
    
    if (nomeExists) {
      return { isValid: false, error: 'Já existe uma categoria com este nome' };
    }
    
    return { isValid: true };
  }, [categorias, editingState.id]);

  // Adicionar nova categoria com validação
  const adicionarCategoria = useCallback(async (nome: string, cor: string) => {
    const validation = validateCategoria(nome, cor);
    if (!validation.isValid) {
      toast.error(validation.error);
      return false;
    }

    setIsLoading(true);
    try {
      addCategory({ nome: nome.trim(), cor });
      return true;
    } catch (error) {
      toast.error('Erro ao adicionar categoria');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [addCategory, validateCategoria]);

  // Iniciar edição de categoria
  const iniciarEdicao = useCallback((categoria: Categoria) => {
    setEditingState({
      id: categoria.id,
      originalData: { nome: categoria.nome, cor: categoria.cor }
    });
  }, []);

  // Salvar edição com validação
  const salvarEdicao = useCallback(async (nome: string, cor: string) => {
    if (!editingState.id) return false;

    const validation = validateCategoria(nome, cor);
    if (!validation.isValid) {
      toast.error(validation.error);
      return false;
    }

    setIsLoading(true);
    try {
      updateCategory(editingState.id, { nome: nome.trim(), cor });
      setEditingState({ id: null, originalData: null });
      return true;
    } catch (error) {
      toast.error('Erro ao atualizar categoria');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [editingState.id, updateCategory, validateCategoria]);

  // Cancelar edição
  const cancelarEdicao = useCallback(() => {
    setEditingState({ id: null, originalData: null });
  }, []);

  // Remover categoria com verificação de dependências
  const removerCategoria = useCallback(async (id: string) => {
    const categoria = categorias.find(cat => cat.id === id);
    if (!categoria) return false;

    const pacotesVinculados = pacotes.filter(pacote => pacote.categoria_id === id);
    if (pacotesVinculados.length > 0) {
      const nomesPacotes = pacotesVinculados.map(p => p.nome).join(', ');
      toast.error(
        `Não é possível remover esta categoria. Ela está sendo usada nos pacotes: ${nomesPacotes}`
      );
      return false;
    }

    setIsLoading(true);
    try {
      const success = deleteCategory(id);
      return success;
    } catch (error) {
      toast.error('Erro ao remover categoria');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [categorias, pacotes, deleteCategory]);

  // Estatísticas úteis
  const stats = useMemo(() => ({
    total: categorias.length,
    emUso: categorias.filter(cat => 
      pacotes.some(pacote => pacote.categoria_id === cat.id)
    ).length,
    semUso: categorias.filter(cat => 
      !pacotes.some(pacote => pacote.categoria_id === cat.id)
    ).length
  }), [categorias, pacotes]);

  // Verificar se uma categoria pode ser removida
  const podeRemoverCategoria = useCallback((id: string) => {
    return !pacotes.some(pacote => pacote.categoria_id === id);
  }, [pacotes]);

  return {
    // Dados
    categorias,
    stats,
    
    // Estados de interface
    editingState,
    isLoading,
    
    // Ações
    adicionarCategoria,
    iniciarEdicao,
    salvarEdicao,
    cancelarEdicao,
    removerCategoria,
    
    // Utilitários
    validateCategoria,
    podeRemoverCategoria
  };
}