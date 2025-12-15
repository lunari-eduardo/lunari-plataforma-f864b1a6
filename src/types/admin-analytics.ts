// Tipos para analytics do painel admin

export interface FaturamentoPorCidade {
  cidade: string;
  estado: string;
  faturamento_total: number;
  total_fotografos: number;
  ticket_medio: number;
  mes: string | null;
}

export interface FaturamentoPorNicho {
  nicho: string;
  faturamento_total: number;
  total_usuarios: number;
  ticket_medio: number;
  mes: string | null;
}

export interface FaturamentoPorCidadeNicho {
  cidade: string;
  estado: string;
  nicho: string;
  faturamento_total: number;
  total_usuarios: number;
  mes: string | null;
}

export interface CrescimentoMensal {
  mes: string;
  faturamento: number;
  fotografos_ativos: number;
  total_transacoes: number;
}

export interface AdminFilters {
  periodo: 'mes_atual' | 'ultimo_trimestre' | 'ultimo_ano' | 'todos';
  nicho?: string;
  cidade?: string;
  tipoUsuario?: 'todos' | 'vip' | 'trial' | 'ativo' | 'autorizado' | 'expirado';
}

export interface AdminKpis {
  faturamentoTotal: number;
  ticketMedio: number;
  fotografosAtivos: number;
  crescimentoPercentual: number;
}
