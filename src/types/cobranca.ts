export type TipoCobranca = 'pix' | 'link';
export type StatusCobranca = 'pendente' | 'pago' | 'cancelado' | 'expirado';
export type ProvedorPagamento = 'mercadopago' | 'infinitepay' | 'pix_manual';

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
  createdAt: string;
  updatedAt: string;
}

export interface CreateCobrancaRequest {
  clienteId: string;
  sessionId?: string;
  valor: number;
  descricao?: string;
  tipoCobranca: TipoCobranca;
  provedor?: ProvedorPagamento;
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
