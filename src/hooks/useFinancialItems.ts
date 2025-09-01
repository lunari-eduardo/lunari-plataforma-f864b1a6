/**
 * HOOK DE GERENCIAMENTO DE ITENS FINANCEIROS
 * 
 * Centraliza toda a lógica de estado e operações CRUD dos itens financeiros
 * com validações integradas e cache otimizado
 */

import { useState, useCallback, useMemo } from 'react';
import { ItemFinanceiro, GrupoPrincipal } from '@/types/financas';
import { agruparItensPorGrupo } from '@/utils/financialItemsUtils';
import { useFinancialValidation } from './useFinancialValidation';
import { MENSAGENS } from '@/constants/financialConstants';

interface UseFinancialItemsProps {
  itensFinanceiros: ItemFinanceiro[];
  adicionarItemFinanceiro: (nome: string, grupo: GrupoPrincipal) => Promise<any>;
  removerItemFinanceiro: (id: string) => Promise<void>;
  atualizarItemFinanceiro: (id: string, dadosAtualizados: Partial<ItemFinanceiro>) => Promise<any>;
}

export function useFinancialItems({
  itensFinanceiros,
  adicionarItemFinanceiro,
  removerItemFinanceiro,
  atualizarItemFinanceiro
}: UseFinancialItemsProps) {
  
  // ============= ESTADO LOCAL =============
  
  const [novoItem, setNovoItem] = useState({
    nome: '',
    grupo: 'Despesa Fixa' as GrupoPrincipal
  });
  
  const [itemEditando, setItemEditando] = useState<{
    id: string;
    nome: string;
  } | null>(null);

  const [loading, setLoading] = useState({
    adicionando: false,
    editando: false,
    removendo: ''
  });

  // ============= HOOKS =============
  
  const {
    validarNovoItem,
    validarEdicaoItem,
    showValidationError,
    showSuccess,
    showError
  } = useFinancialValidation();

  // ============= MEMOIZAÇÃO =============
  
  const itensPorGrupo = useMemo(() => 
    agruparItensPorGrupo(itensFinanceiros), 
    [itensFinanceiros]
  );

  const totalItensAtivos = useMemo(() => 
    itensFinanceiros.filter(item => item.ativo).length,
    [itensFinanceiros]
  );

  // ============= HANDLERS DE ADIÇÃO =============
  
  const handleAdicionarItem = useCallback(async () => {
    const { nome, grupo } = novoItem;
    
    // Validação
    const validacao = validarNovoItem(nome, itensFinanceiros);
    if (!validacao.valido) {
      showValidationError(validacao.erro!);
      return;
    }

    setLoading(prev => ({ ...prev, adicionando: true }));
    
    try {
      await adicionarItemFinanceiro(nome.trim(), grupo);
      setNovoItem({ nome: '', grupo: 'Despesa Fixa' });
      showSuccess(MENSAGENS.SUCESSO.ITEM_ADICIONADO);
    } catch (error) {
      console.error('Erro ao adicionar item:', error);
      showError(MENSAGENS.ERRO.ADICIONAR_ITEM);
    } finally {
      setLoading(prev => ({ ...prev, adicionando: false }));
    }
  }, [novoItem, itensFinanceiros, validarNovoItem, adicionarItemFinanceiro, showValidationError, showSuccess, showError]);

  // ============= HANDLERS DE EDIÇÃO =============
  
  const handleEditarItem = useCallback((item: ItemFinanceiro) => {
    setItemEditando({
      id: item.id,
      nome: item.nome
    });
  }, []);

  const handleSalvarEdicao = useCallback(async () => {
    if (!itemEditando) return;
    
    const { id, nome } = itemEditando;
    
    // Validação
    const validacao = validarEdicaoItem(nome, itensFinanceiros, id);
    if (!validacao.valido) {
      showValidationError(validacao.erro!);
      return;
    }

    setLoading(prev => ({ ...prev, editando: true }));
    
    try {
      await atualizarItemFinanceiro(id, { nome: nome.trim() });
      setItemEditando(null);
      showSuccess(MENSAGENS.SUCESSO.ITEM_ATUALIZADO);
    } catch (error) {
      console.error('Erro ao atualizar item:', error);
      showError(MENSAGENS.ERRO.ATUALIZAR_ITEM);
    } finally {
      setLoading(prev => ({ ...prev, editando: false }));
    }
  }, [itemEditando, itensFinanceiros, validarEdicaoItem, atualizarItemFinanceiro, showValidationError, showSuccess, showError]);

  const handleCancelarEdicao = useCallback(() => {
    setItemEditando(null);
  }, []);

  // ============= HANDLERS DE REMOÇÃO =============
  
  const handleRemoverItem = useCallback(async (id: string) => {
    const item = itensFinanceiros.find(i => i.id === id);
    if (!item) return;

    setLoading(prev => ({ ...prev, removendo: id }));
    
    try {
      await removerItemFinanceiro(id);
      showSuccess(MENSAGENS.SUCESSO.ITEM_REMOVIDO);
    } catch (error: any) {
      console.error('Erro ao remover item:', error);
      showError(error.message || MENSAGENS.ERRO.REMOVER_ITEM);
    } finally {
      setLoading(prev => ({ ...prev, removendo: '' }));
    }
  }, [itensFinanceiros, removerItemFinanceiro, showSuccess, showError]);

  // ============= HANDLERS DE FORMULÁRIO =============
  
  const updateNovoItem = useCallback((updates: Partial<typeof novoItem>) => {
    setNovoItem(prev => ({ ...prev, ...updates }));
  }, []);

  const updateItemEditando = useCallback((nome: string) => {
    setItemEditando(prev => prev ? { ...prev, nome } : null);
  }, []);

  // ============= VALIDAÇÕES DE ESTADO =============
  
  const podeAdicionarItem = useMemo(() => {
    return novoItem.nome.trim().length > 0 && !loading.adicionando;
  }, [novoItem.nome, loading.adicionando]);

  const podeSalvarEdicao = useMemo(() => {
    return itemEditando?.nome.trim().length > 0 && !loading.editando;
  }, [itemEditando, loading.editando]);

  // ============= RETORNO =============
  
  return {
    // Estado
    novoItem,
    itemEditando,
    loading,
    
    // Dados processados
    itensPorGrupo,
    totalItensAtivos,
    
    // Handlers
    handleAdicionarItem,
    handleEditarItem,
    handleSalvarEdicao,
    handleCancelarEdicao,
    handleRemoverItem,
    
    // Atualizadores
    updateNovoItem,
    updateItemEditando,
    
    // Validações
    podeAdicionarItem,
    podeSalvarEdicao
  };
}