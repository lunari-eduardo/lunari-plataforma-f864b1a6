export type TipoCobranca = 'pix' | 'link';
export type StatusCobranca = 'pendente' | 'pago' | 'cancelado' | 'expirado';

export interface Cobranca {
  id: string;
  userId: string;
  clienteId: string;
  sessionId?: string;
  valor: number;
  descricao?: string;
  tipoCobranca: TipoCobranca;
  status: StatusCobranca;
  mpPaymentId?: string;
  mpPreferenceId?: string;
  mpQrCode?: string;
  mpQrCodeBase64?: string;
  mpPixCopiaCola?: string;
  mpPaymentLink?: string;
  mpExpirationDate?: string;
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
}

export interface CobrancaResponse {
  success: boolean;
  cobranca?: Cobranca;
  error?: string;
  // Pix specific
  qrCode?: string;
  qrCodeBase64?: string;
  pixCopiaCola?: string;
  // Link specific
  paymentLink?: string;
  // Card specific
  checkoutUrl?: string;
}

export interface ClienteCobranca {
  id: string;
  nome: string;
  email?: string;
  whatsapp?: string;
}
