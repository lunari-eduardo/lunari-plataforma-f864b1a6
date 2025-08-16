export interface LossReason {
  id: string;
  label: string;
  order: number;
}

export const DEFAULT_LOSS_REASONS: LossReason[] = [
  { id: 'cliente_nao_respondeu', label: 'Cliente não respondeu', order: 1 },
  { id: 'valor_fora_orcamento', label: 'Valor fora do orçamento', order: 2 },
  { id: 'concorrencia', label: 'Concorrência', order: 3 },
  { id: 'problema_agenda', label: 'Problema de agenda', order: 4 },
  { id: 'outro', label: 'Outro', order: 5 },
];

export const getLossReasons = (): LossReason[] => {
  // Future: Load from user configuration
  return DEFAULT_LOSS_REASONS;
};