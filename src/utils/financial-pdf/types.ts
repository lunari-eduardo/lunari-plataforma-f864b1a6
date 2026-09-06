import { UserProfile } from '@/services/ProfileService';
import { UserBranding } from '@/types/userProfile';
import { TransacaoComItem } from '@/types/financas';

export interface FinancialExportData {
  profile: UserProfile;
  branding: UserBranding;
  transactions: TransacaoComItem[];
  period: {
    month: number;
    year: number;
    isAnnual?: boolean;
    startDate?: string;
    endDate?: string;
  };
  summary: {
    totalReceitas: number;
    totalDespesas: number;
    saldoFinal: number;
    transacoesPagas: number;
    transacoesFaturadas: number;
    transacoesAgendadas: number;
  };
  // Opcional: mapa de receitas operacionais (Workflow) por mês quando anual
  workflowMonthlyReceita?: Record<number, number>;
}

export interface ExportOptions {
  type: 'monthly' | 'annual';
  period: {
    month?: number;
    year: number;
    startMonth?: number;
    endMonth?: number;
  };
  includeDetails: boolean;
  includeGraphics: boolean;
}

export interface DemonstrativeExportData {
  profile: UserProfile;
  branding: UserBranding;
  period: {
    startDate: string;
    endDate: string;
  };
  demonstrativo: {
    receitas: {
      sessoes: number;
      produtos: number;
      naoOperacionais: number;
      totalReceitas: number;
    };
    despesas: {
      categorias: Array<{
        grupo: string;
        itens: Array<{ nome: string; valor: number }>;
        total: number;
      }>;
      totalDespesas: number;
    };
    resumoFinal: {
      receitaTotal: number;
      despesaTotal: number;
      resultadoLiquido: number;
      margemLiquida: number;
    };
  };
}

export const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];
