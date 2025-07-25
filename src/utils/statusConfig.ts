export interface StatusConfig {
  label: string;
  color: string;
  bgColor: string;
  textColor: string;
  borderColor: string;
}

export const BUDGET_STATUS_CONFIG: Record<string, StatusConfig> = {
  rascunho: {
    label: 'Novo',
    color: '#3B82F6', // blue-500
    bgColor: 'bg-blue-100',
    textColor: 'text-blue-800',
    borderColor: 'border-blue-500'
  },
  pendente: {
    label: 'Pendente',
    color: '#EAB308', // yellow-500
    bgColor: 'bg-yellow-100',
    textColor: 'text-yellow-800',
    borderColor: 'border-yellow-500'
  },
  enviado: {
    label: 'Enviado',
    color: '#6B7280', // gray-500
    bgColor: 'bg-gray-100',
    textColor: 'text-gray-800',
    borderColor: 'border-gray-500'
  },
  'follow-up': {
    label: 'Follow-up',
    color: '#F97316', // orange-500
    bgColor: 'bg-orange-100',
    textColor: 'text-orange-800',
    borderColor: 'border-orange-500'
  },
  fechado: {
    label: 'Fechado',
    color: '#10B981', // green-500
    bgColor: 'bg-green-100',
    textColor: 'text-green-800',
    borderColor: 'border-green-500'
  },
  cancelado: {
    label: 'Cancelado',
    color: '#EF4444', // red-500
    bgColor: 'bg-red-100',
    textColor: 'text-red-800',
    borderColor: 'border-red-500'
  }
};

export const getBudgetStatusConfig = (status: string): StatusConfig => {
  return BUDGET_STATUS_CONFIG[status] || BUDGET_STATUS_CONFIG.rascunho;
};