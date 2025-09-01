/**
 * CONSTANTES FINANCEIRAS CENTRALIZADAS
 * 
 * Centraliza todas as constantes utilizadas no módulo financeiro
 * para garantir consistência e facilitar manutenção
 */

import { GrupoPrincipal } from '@/types/financas';

// ============= GRUPOS PRINCIPAIS =============
export const GRUPOS_PRINCIPAIS: GrupoPrincipal[] = [
  'Despesa Fixa',
  'Despesa Variável', 
  'Investimento',
  'Receita Não Operacional'
];

// ============= CORES POR GRUPO =============
export const CORES_GRUPO: Record<GrupoPrincipal, string> = {
  'Despesa Fixa': 'bg-destructive/10 text-destructive border-destructive/20',
  'Despesa Variável': 'bg-lunar-warning/10 text-lunar-warning border-lunar-warning/20',
  'Investimento': 'bg-primary/10 text-primary border-primary/20',
  'Receita Não Operacional': 'bg-availability/10 text-availability border-availability/20'
};

// ============= TEXTOS PADRÃO =============
export const MENSAGENS = {
  ERRO: {
    NOME_OBRIGATORIO: 'Por favor, insira um nome para o item.',
    NOME_DUPLICADO: 'Já existe um item com este nome.',
    NOME_VALIDO: 'Por favor, insira um nome válido.',
    ADICIONAR_ITEM: 'Erro ao adicionar item financeiro.',
    ATUALIZAR_ITEM: 'Erro ao atualizar item financeiro.',
    REMOVER_ITEM: 'Erro ao remover item financeiro.',
    DIAS_INVALIDOS: 'Dias devem estar entre 1 e 31',
    ADICIONAR_CARTAO: 'Erro ao adicionar cartão',
    REMOVER_CARTAO: 'Erro ao remover cartão'
  },
  SUCESSO: {
    ITEM_ADICIONADO: 'Item adicionado com sucesso!',
    ITEM_ATUALIZADO: 'Item atualizado com sucesso!',
    ITEM_REMOVIDO: 'Item removido com sucesso!',
    CARTAO_ADICIONADO: 'Cartão adicionado com sucesso!',
    CARTAO_REMOVIDO: 'Cartão removido com sucesso!',
    SINCRONIZACAO: 'Sincronização concluída com sucesso!'
  },
  CONFIRMACAO: {
    REMOVER_ITEM: (nome: string) => ({
      title: "Remover Item Financeiro",
      description: `Tem certeza que deseja remover "${nome}"? Esta ação também removerá todas as transações relacionadas.`,
      confirmText: "Remover",
      cancelText: "Cancelar"
    }),
    REMOVER_CARTAO: (nome: string) => ({
      title: "Remover Cartão",
      description: `Tem certeza que deseja remover o cartão "${nome}"?`,
      confirmText: "Remover", 
      cancelText: "Cancelar"
    })
  }
};

// ============= CONFIGURAÇÕES =============
export const CONFIG = {
  POLLING_INTERVAL: 2000, // Intervalo de polling em ms
  FORM_VALIDATION: {
    MIN_DIA_MES: 1,
    MAX_DIA_MES: 31
  }
};

// ============= PLACEHOLDER TEXTS =============
export const PLACEHOLDERS = {
  NOME_ITEM: 'Ex: Adobe, Combustível, etc.',
  NOME_CARTAO: 'Ex: Nubank, Itaú, etc.',
  DIA_VENCIMENTO: 'Ex: 15',
  DIA_FECHAMENTO: 'Ex: 10'
};