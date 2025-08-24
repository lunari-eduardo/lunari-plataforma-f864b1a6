export interface FinancialExportOptions {
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

export interface FinancialSummary {
  totalReceitas: number;
  totalDespesas: number;
  saldoFinal: number;
  transacoesPagas: number;
  transacoesFaturadas: number;
  transacoesAgendadas: number;
}

export interface ExportConfigState {
  isOpen: boolean;
  type: 'monthly' | 'annual';
  selectedMonth: number;
  selectedYear: number;
  includeDetails: boolean;
  isGenerating: boolean;
}