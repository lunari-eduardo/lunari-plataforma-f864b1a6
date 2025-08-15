export interface StatusConfig {
  label: string;
  color: string;
  bgColor: string;
  textColor: string;
  borderColor: string;
}

export const BUDGET_STATUS_CONFIG: Record<string, StatusConfig> = {
  pendente: {
    label: 'Pendente',
    color: 'hsl(var(--lunar-warning))',
    bgColor: 'bg-lunar-warning/15',
    textColor: 'text-lunar-warning',
    borderColor: 'border-lunar-warning'
  },
  enviado: {
    label: 'Enviado',
    color: 'hsl(var(--muted-foreground))',
    bgColor: 'bg-muted',
    textColor: 'text-muted-foreground',
    borderColor: 'border-border'
  },
  followup: {
    label: 'Followup',
    color: 'hsl(var(--lunar-accent))',
    bgColor: 'bg-lunar-accent/10',
    textColor: 'text-lunar-accent',
    borderColor: 'border-lunar-accent'
  },
  fechado: {
    label: 'Fechado',
    color: 'hsl(var(--lunar-success))',
    bgColor: 'bg-lunar-success/15',
    textColor: 'text-lunar-success',
    borderColor: 'border-lunar-success'
  },
  perdido: {
    label: 'Perdido',
    color: 'hsl(var(--lunar-error))',
    bgColor: 'bg-lunar-error/15',
    textColor: 'text-lunar-error',
    borderColor: 'border-lunar-error'
  }
};

export const getBudgetStatusConfig = (status: string): StatusConfig => {
  return BUDGET_STATUS_CONFIG[status] || BUDGET_STATUS_CONFIG.pendente;
};