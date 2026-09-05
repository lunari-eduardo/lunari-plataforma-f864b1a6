import React from 'react';

export interface AccountFees {
  creditCard: {
    operationValue: number;
    detachedMonthlyFeeValue: number;
    installmentMonthlyFeeValue: number;
    tiers: Array<{ min: number; max: number; percentageFee: number }>;
  };
  pix: {
    fixedFeeValue: number;
  };
  discount?: {
    active: boolean;
    expiration?: string;
    tiers: Array<{ min: number; max: number; percentageFee: number }>;
  };
}

export const MERCADOPAGO_DEFAULT_FEES: AccountFees = {
  creditCard: {
    operationValue: 0,
    detachedMonthlyFeeValue: 0,
    installmentMonthlyFeeValue: 0,
    tiers: [
      { min: 1, max: 1, percentageFee: 4.98 },
      { min: 2, max: 2, percentageFee: 7.90 },
      { min: 3, max: 3, percentageFee: 9.20 },
      { min: 4, max: 4, percentageFee: 10.50 },
      { min: 5, max: 5, percentageFee: 11.80 },
      { min: 6, max: 6, percentageFee: 13.10 },
      { min: 7, max: 7, percentageFee: 14.50 },
      { min: 8, max: 8, percentageFee: 15.80 },
      { min: 9, max: 9, percentageFee: 17.10 },
      { min: 10, max: 10, percentageFee: 18.40 },
      { min: 11, max: 11, percentageFee: 19.70 },
      { min: 12, max: 12, percentageFee: 21.00 },
    ],
  },
  pix: {
    fixedFeeValue: 0,
  },
};

export interface AsaasCheckoutData {
  galeriaId?: string;
  userId: string;
  valorTotal: number;
  descricao: string;
  qtdFotos?: number;
  cobrancaId?: string;
  provedor?: string;
  mpPublicKey?: string;
  finalidade?: string;
  clienteId?: string;
  sessionId?: string;
  galleryToken?: string;
  visitorId?: string;
  enabledMethods: { pix: boolean; creditCard: boolean; boleto?: boolean };
  maxParcelas: number;
  absorverTaxa: boolean;
  /** "Vou antecipar recebíveis?" — campo granular */
  ireiAntecipar?: boolean;
  /** "Repassar custo da antecipação ao cliente?" — campo granular */
  repassarTaxaAntecipacao?: boolean;
  /** Legacy fallback — quando false, apenas taxa de processamento é cobrada (sem antecipação) */
  incluirTaxaAntecipacao?: boolean;
  // Legacy fields (kept for backward compat but ignored when accountFees is available)
  taxaAntecipacao?: boolean;
  taxaAntecipacaoPercentual?: number;
  taxaAntecipacaoCreditoAvista?: number;
  taxaAntecipacaoCreditoParcelado?: number;
}

export interface PayerHintsPrefill {
  fullName?: string | null;
  email?: string | null;
  phone?: string | null;
  cpfCnpj?: string | null;
}

export interface PayerHintsMissingFlags {
  name?: boolean;
  email?: boolean;
  phone?: boolean;
  cpfCnpj?: boolean;
}

export interface AsaasCheckoutProps {
  data: AsaasCheckoutData;
  studioName?: string;
  studioLogoUrl?: string;
  onPaymentConfirmed: () => void;
  onCancel?: () => void;
  onMissingCpf?: () => void;
  /** Valores já conhecidos do pagador — pré-preenchem os campos do checkout. */
  payerHints?: PayerHintsPrefill;
  /** Quais campos faltam no cadastro (backend). Direciona quais aparecem inline no PIX. */
  payerMissing?: PayerHintsMissingFlags;
  /** Persiste os dados no cadastro do cliente antes de gerar a cobrança. */
  onPersistContact?: (data: { email?: string; phone?: string; nome?: string; cpfCnpj?: string }) => Promise<void>;
  themeStyles?: React.CSSProperties;
  backgroundMode?: 'light' | 'dark';
  initialAccountFees?: AccountFees;
}
