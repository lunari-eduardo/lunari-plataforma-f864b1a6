import { GrupoPrincipal } from '@/types/financas';

export const FINANCIAL_GROUPS: GrupoPrincipal[] = [
  'Despesa Fixa', 
  'Despesa Variável', 
  'Investimento', 
  'Receita Não Operacional'
];

export const GROUP_COLORS: Record<GrupoPrincipal, string> = {
  'Despesa Fixa': 'bg-destructive/10 text-destructive border-destructive/20',
  'Despesa Variável': 'bg-lunar-warning/10 text-lunar-warning border-lunar-warning/20',
  'Investimento': 'bg-primary/10 text-primary border-primary/20',
  'Receita Não Operacional': 'bg-availability/10 text-availability border-availability/20'
};

export const POLLING_INTERVAL = 2000;

export const TOAST_MESSAGES = {
  SUCCESS_ADD: "Item adicionado com sucesso!",
  SUCCESS_UPDATE: "Item atualizado com sucesso!",
  SUCCESS_DELETE: "Item removido com sucesso!",
  ERROR_EMPTY_NAME: "Por favor, insira um nome para o item.",
  ERROR_INVALID_NAME: "Por favor, insira um nome válido.",
  ERROR_DUPLICATE_NAME: "Já existe um item com este nome.",
  ERROR_GENERIC_ADD: "Erro ao adicionar item financeiro.",
  ERROR_GENERIC_UPDATE: "Erro ao atualizar item financeiro.",
  ERROR_GENERIC_DELETE: "Erro ao remover item financeiro.",
  SYNC_SUCCESS: "Sincronização com Supabase realizada com sucesso",
  SYNC_ERROR: "Erro ao sincronizar com Supabase",
  SYNC_NOT_CONNECTED: "Supabase não está conectado. Conecte primeiro para sincronizar.",
  SYNC_COMPLETE: "Os itens foram importados da precificação com sucesso!"
} as const;