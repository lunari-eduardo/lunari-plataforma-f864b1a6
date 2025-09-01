/**
 * HOOK DE VALIDAÇÃO FINANCEIRA
 * 
 * Centraliza todas as validações do módulo financeiro com mensagens padronizadas
 */

import { useCallback } from 'react';
import { ItemFinanceiro, CartaoCredito } from '@/types/financas';
import { validarNomeExistente, validarNomeValido, validarDiaMes } from '@/utils/financialItemsUtils';
import { MENSAGENS } from '@/constants/financialConstants';
import { useToast } from '@/hooks/use-toast';

export function useFinancialValidation() {
  const { toast } = useToast();

  // ============= VALIDAÇÕES DE ITENS FINANCEIROS =============
  
  const validarNovoItem = useCallback((
    nome: string,
    itens: ItemFinanceiro[]
  ): { valido: boolean; erro?: string } => {
    if (!validarNomeValido(nome)) {
      return { valido: false, erro: MENSAGENS.ERRO.NOME_OBRIGATORIO };
    }

    if (validarNomeExistente(nome, itens)) {
      return { valido: false, erro: MENSAGENS.ERRO.NOME_DUPLICADO };
    }

    return { valido: true };
  }, []);

  const validarEdicaoItem = useCallback((
    nome: string,
    itens: ItemFinanceiro[],
    itemId: string
  ): { valido: boolean; erro?: string } => {
    if (!validarNomeValido(nome)) {
      return { valido: false, erro: MENSAGENS.ERRO.NOME_VALIDO };
    }

    if (validarNomeExistente(nome, itens, itemId)) {
      return { valido: false, erro: MENSAGENS.ERRO.NOME_DUPLICADO };
    }

    return { valido: true };
  }, []);

  // ============= VALIDAÇÕES DE CARTÕES =============
  
  const validarNovoCartao = useCallback((
    nome: string,
    diaVencimento: number,
    diaFechamento: number,
    cartoes: CartaoCredito[]
  ): { valido: boolean; erro?: string } => {
    if (!validarNomeValido(nome)) {
      return { valido: false, erro: MENSAGENS.ERRO.NOME_OBRIGATORIO };
    }

    if (!validarDiaMes(diaVencimento) || !validarDiaMes(diaFechamento)) {
      return { valido: false, erro: MENSAGENS.ERRO.DIAS_INVALIDOS };
    }

    const cartaoExistente = cartoes.find(cartao => 
      cartao.nome.toLowerCase() === nome.trim().toLowerCase()
    );
    
    if (cartaoExistente) {
      return { valido: false, erro: 'Já existe um cartão com este nome.' };
    }

    return { valido: true };
  }, []);

  // ============= HELPERS COM TOAST =============
  
  const showValidationError = useCallback((erro: string) => {
    toast({
      title: "Erro de Validação",
      description: erro,
      variant: "destructive"
    });
  }, [toast]);

  const showSuccess = useCallback((mensagem: string) => {
    toast({
      title: "Sucesso",
      description: mensagem
    });
  }, [toast]);

  const showError = useCallback((mensagem: string) => {
    toast({
      title: "Erro",
      description: mensagem,
      variant: "destructive"
    });
  }, [toast]);

  return {
    // Validações
    validarNovoItem,
    validarEdicaoItem,
    validarNovoCartao,
    
    // Helpers de notificação
    showValidationError,
    showSuccess,
    showError
  };
}