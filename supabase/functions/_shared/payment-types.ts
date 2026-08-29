// supabase/functions/_shared/payment-types.ts
// Definições de tipos e interfaces padronizadas para o subsistema de pagamentos do Lunari

export type ProvedorPagamento = 'mercadopago' | 'infinitepay' | 'asaas' | 'pix_manual';

export type FinalidadeCobranca = 'sessao' | 'fotos_extras' | 'sessao_e_extras';

export type StatusCobranca =
  | 'pendente'
  | 'processando'
  | 'pago'
  | 'recusado'
  | 'expirado'
  | 'cancelado'
  | 'estornado'
  | 'chargeback'
  | 'parcialmente_estornado'
  | 'falha';

export type TipoCobranca = 'link' | 'pix' | 'cartao' | 'boleto' | 'manual';

export interface ClienteContact {
  id?: string;
  nome?: string;
  email?: string;
  telefone?: string;
  whatsapp?: string;
  cpfCnpj?: string;
  cep?: string;
  endereco?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  cidade?: string;
  uf?: string;
}

export interface CreditCardData {
  holderName: string;
  number: string;
  expiryMonth: string;
  expiryYear: string;
  ccv: string;
}

export interface CreditCardHolderInfo {
  name: string;
  cpfCnpj: string;
  email: string;
  phone: string;
  postalCode: string;
  addressNumber: string;
}

export interface CreateCobrancaRequest {
  idempotencyKey?: string;
  clienteId: string;
  sessionId?: string;
  galeriaId?: string;
  valor: number;
  descricao?: string;
  provedor: ProvedorPagamento;
  finalidade?: FinalidadeCobranca;
  qtdFotos?: number;
  snapshotFotosIncluidas?: number | null;
  valorSessaoComponente?: number;
  valorExtrasComponente?: number;
  billingType?: 'PIX' | 'CREDIT_CARD' | 'BOLETO' | 'UNDEFINED';
  payerContact?: ClienteContact;
  creditCard?: CreditCardData;
  cardToken?: string;
  creditCardHolderInfo?: CreditCardHolderInfo;
  installmentCount?: number;
  correlationId?: string;
  allowAmbiguous?: boolean;
  dadosExtras?: Record<string, any>;
}

export interface CreateCobrancaResponse {
  success: boolean;
  cobrancaId?: string;
  checkoutUrl?: string;
  paymentLink?: string;
  socialShareUrl?: string;
  pixCopiaCola?: string;
  pixQrCodeBase64?: string;
  pixQrCodeMissing?: boolean;
  provedor?: ProvedorPagamento;
  status?: StatusCobranca;
  paid?: boolean;
  creditCardStatus?: string;
  requiresPolling?: boolean;
  paymentId?: string;
  error?: string;
  errorCode?: string;
  reused?: boolean;
}

export interface AdapterCreatePaymentInput {
  cobrancaId: string;
  userId: string;
  valor: number;
  descricao: string;
  cliente: ClienteContact;
  clientIp?: string;
  requestDadosExtras?: Record<string, any>;
  integrationData: {
    accessToken?: string | null;
    dadosExtras?: Record<string, any> | null;
  };
  billingType?: 'PIX' | 'CREDIT_CARD' | 'BOLETO' | 'UNDEFINED';
  creditCard?: CreditCardData;
  cardToken?: string;
  creditCardHolderInfo?: CreditCardHolderInfo;
  installmentCount?: number;
  correlationId?: string;
}

export interface AdapterCreatePaymentOutput {
  success: boolean;
  providerOrderId?: string;
  providerTransactionId?: string;
  checkoutUrl?: string;
  pixCopiaCola?: string;
  pixQrCodeBase64?: string;
  pixQrCodeMissing?: boolean;
  dadosExtras?: Record<string, any>;
  error?: string;
  errorCode?: string;
}
