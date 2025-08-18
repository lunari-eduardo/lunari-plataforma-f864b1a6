export interface ClientPaymentPlan {
  id: string;
  sessionId: string; // Vinculado ao workflow
  clienteId: string;
  valorTotal: number;
  formaPagamento: 'avista' | 'parcelado';
  numeroParcelas: number;
  valorParcela: number;
  diaVencimento: number;
  status: 'ativo' | 'quitado' | 'em_atraso';
  observacoes?: string;
  criadoEm: string;
}

export interface PaymentInstallment {
  id: string;
  paymentPlanId: string;
  numeroParcela: number;
  valor: number;
  dataVencimento: string;
  status: 'pendente' | 'pago';
  dataPagamento?: string;
  observacoes?: string;
}

export interface ReceivablesMetrics {
  totalAReceber: number;
  totalEmAtraso: number;
  totalQuitado: number;
  quantidadeParcelas: number;
  quantidadeEmAtraso: number;
}

export interface ReceivablesSummary {
  mesAtual: ReceivablesMetrics;
  proximoMes: ReceivablesMetrics;
  vencimentosHoje: PaymentInstallment[];
  vencimentosProximos: PaymentInstallment[];
}