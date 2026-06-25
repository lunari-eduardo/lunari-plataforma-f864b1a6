export type TipoCobranca = 'pix' | 'link';
export type StatusCobranca = 'pendente' | 'parcialmente_pago' | 'pago' | 'cancelado' | 'expirado';
export type ProvedorPagamento = 'mercadopago' | 'infinitepay' | 'pix_manual' | 'asaas';

export interface Cobranca {
  id: string;
  userId: string;
  clienteId: string;
  sessionId?: string;
  valor: number;
  descricao?: string;
  tipoCobranca: TipoCobranca;
  status: StatusCobranca;
  provedor: ProvedorPagamento;
  // Mercado Pago fields
  mpPaymentId?: string;
  mpPreferenceId?: string;
  mpQrCode?: string;
  mpQrCodeBase64?: string;
  mpPixCopiaCola?: string;
  mpPaymentLink?: string;
  mpExpirationDate?: string;
  // InfinitePay fields
  ipCheckoutUrl?: string;
  ipOrderNsu?: string;
  ipTransactionNsu?: string;
  ipReceiptUrl?: string;
  // Common fields
  dataPagamento?: string;
  valorLiquido?: number;
  createdAt: string;
  updatedAt: string;
  // Installment fields
  totalParcelas?: number;
  parcelasPagas?: number;
  asaasInstallmentId?: string;
}

export interface CreateCobrancaRequest {
  clienteId: string;
  sessionId?: string;
  valor: number;
  descricao?: string;
  tipoCobranca: TipoCobranca;
  provedor?: ProvedorPagamento;
  // Contrato Gestão↔Gallery — quando 'fotos_extras', galeriaId e qtdFotos são obrigatórios
  finalidade?: 'sessao' | 'fotos_extras';
  galeriaId?: string;
  qtdFotos?: number;
  snapshotFotosIncluidas?: number | null;
  correlationId?: string;
}

export interface CobrancaResponse {
  success: boolean;
  cobranca?: Cobranca;
  error?: string;
  provedor?: ProvedorPagamento;
  // Pix specific (Mercado Pago only)
  qrCode?: string;
  qrCodeBase64?: string;
  pixCopiaCola?: string;
  // PIX Manual specific
  pixPayload?: string;
  // Link specific
  paymentLink?: string;
  // Checkout URL (InfinitePay)
  checkoutUrl?: string;
}

export interface ClienteCobranca {
  id: string;
  nome: string;
  email?: string;
  whatsapp?: string;
}
