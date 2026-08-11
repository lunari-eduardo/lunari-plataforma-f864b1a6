import { useState, useCallback, useMemo } from 'react';
import { ItemFinanceiro, GrupoPrincipal } from '@/types/financas';
import { groupItemsByCategory } from '@/utils/financialItemsUtils';
import { useFinancialValidation } from './useFinancialValidation';
import { FINANCIAL_GROUPS, TOAST_MESSAGES } from '@/constants/financialConstants';

interface ItemState {
  novoNome: string;
  novoGrupo: GrupoPrincipal;
  novoIcone?: string;
  editandoId: string | null;
  nomeEditando: string;
  iconeEditando?: string;
}

interface UseFinancialItemsManagementProps {
  itensFinanceiros: ItemFinanceiro[];
  adicionarItemFinanceiro: (nome: string, grupo: GrupoPrincipal, icone?: string) => Promise<any>;
  removerItemFinanceiro: (id: string) => Promise<void>;
  atualizarItemFinanceiro: (id: string, dadosAtualizados: Partial<ItemFinanceiro>) => Promise<any>;
}

export function useFinancialItemsManagement({
  itensFinanceiros,
  adicionarItemFinanceiro,
  removerItemFinanceiro,
  atualizarItemFinanceiro
}: UseFinancialItemsManagementProps) {
  // Consolidated state management
    novoNome: '',
    novoGrupo: 'Despesa Fixa',
    novoIcone: '',
    editandoId: null,
    nomeEditando: '',
    iconeEditando: ''
  });

  const { validateAndShowError, showSuccessToast, showErrorToast } = useFinancialValidation(itensFinanceiros);

  // Memoized grouping calculation
  const itensPorGrupo = useMemo(() => 
    groupItemsByCategory(itensFinanceiros, FINANCIAL_GROUPS), 
    [itensFinanceiros]
  );

  // Consolidated and memoized handlers
  const handleAdicionarItem = useCallback(async () => {
    if (!validateAndShowError(itemState.novoNome)) {
      return;
    }
    
    try {
      await adicionarItemFinanceiro(itemState.novoNome.trim(), itemState.novoGrupo, itemState.novoIcone);
      setItemState(prev => ({ ...prev, novoNome: '', novoIcone: '' }));
      showSuccessToast(TOAST_MESSAGES.SUCCESS_ADD);
    } catch (error: any) {
      if (error?.code === 'DUPLICATE_ACTIVE') {
        showErrorToast(error.message || 'Já existe um item com este nome neste grupo.');
      } else {
        showErrorToast(TOAST_MESSAGES.ERROR_GENERIC_ADD);
      }
    }
  }, [itemState.novoNome, itemState.novoGrupo, itemState.novoIcone, adicionarItemFinanceiro, validateAndShowError, showSuccessToast, showErrorToast]);

  const handleEditarItem = useCallback((item: ItemFinanceiro) => {
    setItemState(prev => ({
      ...prev,
      editandoId: item.id,
      nomeEditando: item.nome,
      iconeEditando: item.icone || ''
    }));
  }, []);

  const handleSalvarEdicao = useCallback(async (id: string) => {
    if (!validateAndShowError(itemState.nomeEditando, id)) {
      return;
    }
    
    try {
      await atualizarItemFinanceiro(id, {
        nome: itemState.nomeEditando.trim(),
        icone: itemState.iconeEditando || undefined
      });
      setItemState(prev => ({
        ...prev,
        editandoId: null,
        nomeEditando: '',
        iconeEditando: ''
      }));
      showSuccessToast(TOAST_MESSAGES.SUCCESS_UPDATE);
    } catch (error) {
      showErrorToast(TOAST_MESSAGES.ERROR_GENERIC_UPDATE);
    }
  }, [itemState.nomeEditando, itemState.iconeEditando, atualizarItemFinanceiro, validateAndShowError, showSuccessToast, showErrorToast]);

  const handleCancelarEdicao = useCallback(() => {
    setItemState(prev => ({
      ...prev,
      editandoId: null,
      nomeEditando: '',
      iconeEditando: ''
    }));
  }, []);

  const handleRemoverItem = useCallback(async (id: string) => {
    try {
      await removerItemFinanceiro(id);
      showSuccessToast(TOAST_MESSAGES.SUCCESS_DELETE);
    } catch (error: any) {
      showErrorToast(error.message || TOAST_MESSAGES.ERROR_GENERIC_DELETE);
    }
  }, [removerItemFinanceiro, showSuccessToast, showErrorToast]);

  // State update helpers
  const updateItemState = useCallback((updates: Partial<ItemState>) => {
    setItemState(prev => ({ ...prev, ...updates }));
  }, []);

  return {
    itemState,
    updateItemState,
    itensPorGrupo,
    handleAdicionarItem,
    handleEditarItem,
    handleSalvarEdicao,
    handleCancelarEdicao,
    handleRemoverItem
  };
}