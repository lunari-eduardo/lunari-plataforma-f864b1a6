/**
 * Cálculo de antecipação de recebíveis para cartão de crédito (Asaas).
 *
 * A taxa é **mensal** e se acumula proporcionalmente ao número da parcela.
 * Para a parcela i (1-indexed), a taxa total = taxaMensal × i.
 */

export interface AnticipationDetail {
  parcela: number;
  meses: number;
  taxa: number;       // percentual total aplicado (ex: 2.50)
  valorBruto: number; // valor da parcela antes da antecipação
  liquido: number;    // valor líquido após desconto
}

export interface AnticipationResult {
  valorLiquido: number;
  totalTaxa: number;
  detalheParcelas: AnticipationDetail[];
}

/**
 * Calcula o valor líquido após antecipação de recebíveis.
 *
 * @param valorTotal  Valor total da venda
 * @param parcelas    Número de parcelas (1 = à vista)
 * @param taxaMensal  Taxa mensal em percentual (ex: 1.25 para 1.25%)
 */
export function calcularAntecipacao(
  valorTotal: number,
  parcelas: number,
  taxaMensal: number,
): AnticipationResult {
  if (parcelas <= 0 || valorTotal <= 0 || taxaMensal <= 0) {
    return {
      valorLiquido: valorTotal,
      totalTaxa: 0,
      detalheParcelas: [],
    };
  }

  const valorParcela = valorTotal / parcelas;
  const detalheParcelas: AnticipationDetail[] = [];
  let valorLiquido = 0;

  for (let i = 1; i <= parcelas; i++) {
    const taxaTotal = taxaMensal * i;
    const liquido = valorParcela * (1 - taxaTotal / 100);
    detalheParcelas.push({
      parcela: i,
      meses: i,
      taxa: Math.round(taxaTotal * 100) / 100,
      valorBruto: Math.round(valorParcela * 100) / 100,
      liquido: Math.round(liquido * 100) / 100,
    });
    valorLiquido += liquido;
  }

  valorLiquido = Math.round(valorLiquido * 100) / 100;
  const totalTaxa = Math.round((valorTotal - valorLiquido) * 100) / 100;

  return { valorLiquido, totalTaxa, detalheParcelas };
}

/**
 * Calcula o valor a cobrar do cliente para que o fotógrafo receba
 * exatamente `valorDesejado` após antecipação.
 *
 * valorCobrado = valorDesejado + custoAntecipacao(valorDesejado)
 */
export function calcularValorComAntecipacao(
  valorDesejado: number,
  parcelas: number,
  taxaMensal: number,
): number {
  if (parcelas <= 0 || valorDesejado <= 0 || taxaMensal <= 0) {
    return valorDesejado;
  }

  const { totalTaxa } = calcularAntecipacao(valorDesejado, parcelas, taxaMensal);
  return Math.round((valorDesejado + totalTaxa) * 100) / 100;
}

export interface AsaasFeeTier {
  min: number;
  max: number;
  percentageFee: number;
}

export interface NormalizedAsaasFees {
  creditCard: {
    operationValue: number;
    detachedMonthlyFeeValue: number;
    installmentMonthlyFeeValue: number;
    tiers: AsaasFeeTier[];
  };
  pix: {
    fixedFeeValue: number;
  };
  discount?: {
    active: boolean;
    expiration?: string;
    tiers: AsaasFeeTier[];
  };
}

export function normalizeAsaasFees(rawFees: any): NormalizedAsaasFees {
  if (!rawFees || typeof rawFees !== 'object') {
    return {
      creditCard: {
        operationValue: 0.49,
        detachedMonthlyFeeValue: 1.25,
        installmentMonthlyFeeValue: 1.7,
        tiers: [
          { min: 1, max: 1, percentageFee: 2.99 },
          { min: 2, max: 6, percentageFee: 3.49 },
          { min: 7, max: 12, percentageFee: 3.99 },
          { min: 13, max: 21, percentageFee: 4.29 },
        ],
      },
      pix: { fixedFeeValue: 1.99 },
      discount: { active: false, tiers: [] },
    };
  }

  const paymentCc = rawFees.payment?.creditCard || rawFees.cardSale?.creditCard || rawFees.creditCard || {};
  const anticipationCc = rawFees.anticipation?.creditCard || rawFees.cardSale?.anticipation || {};
  const pixData = rawFees.payment?.pix || rawFees.pix || rawFees.pixDebit || {};

  if (Array.isArray(paymentCc.tiers) && paymentCc.tiers.length > 0) {
    return {
      creditCard: {
        operationValue: Number(paymentCc.operationValue ?? 0.49),
        detachedMonthlyFeeValue: Number(paymentCc.detachedMonthlyFeeValue ?? anticipationCc.detachedMonthlyFeeValue ?? 1.25),
        installmentMonthlyFeeValue: Number(paymentCc.installmentMonthlyFeeValue ?? anticipationCc.installmentMonthlyFeeValue ?? 1.7),
        tiers: paymentCc.tiers,
      },
      pix: {
        fixedFeeValue: Number(pixData.fixedFeeValue ?? pixData.fixedFeeValueWithDiscount ?? 1.99),
      },
      discount: rawFees.discount,
    };
  }

  const oneInstallment = Number(paymentCc.oneInstallmentPercentage ?? 2.99);
  const upToSix = Number(paymentCc.upToSixInstallmentsPercentage ?? 3.49);
  const upToTwelve = Number(paymentCc.upToTwelveInstallmentsPercentage ?? 3.99);
  const upToTwentyOne = Number(paymentCc.upToTwentyOneInstallmentsPercentage ?? 4.29);

  const tiers: AsaasFeeTier[] = [
    { min: 1, max: 1, percentageFee: oneInstallment },
    { min: 2, max: 6, percentageFee: upToSix },
    { min: 7, max: 12, percentageFee: upToTwelve },
    { min: 13, max: 21, percentageFee: upToTwentyOne },
  ];

  const hasDiscount = Boolean(paymentCc.hasValidDiscount);
  const discountTiers: AsaasFeeTier[] = hasDiscount
    ? [
        { min: 1, max: 1, percentageFee: Number(paymentCc.discountOneInstallmentPercentage ?? oneInstallment) },
        { min: 2, max: 6, percentageFee: Number(paymentCc.discountUpToSixInstallmentsPercentage ?? upToSix) },
        { min: 7, max: 12, percentageFee: Number(paymentCc.discountUpToTwelveInstallmentsPercentage ?? upToTwelve) },
        { min: 13, max: 21, percentageFee: Number(paymentCc.discountUpToTwentyOneInstallmentsPercentage ?? upToTwentyOne) },
      ]
    : [];

  const operationValue = Number(paymentCc.operationValue ?? 0.49);
  const detachedMonthly = Number(anticipationCc.detachedMonthlyFeeValue ?? anticipationCc.detachedPercentage ?? 1.25);
  const installmentMonthly = Number(anticipationCc.installmentMonthlyFeeValue ?? anticipationCc.installmentPercentage ?? 1.7);
  const pixFee = Number(pixData.fixedFeeValue ?? pixData.fixedFeeValueWithDiscount ?? 1.99);

  return {
    creditCard: {
      operationValue,
      detachedMonthlyFeeValue: detachedMonthly,
      installmentMonthlyFeeValue: installmentMonthly,
      tiers,
    },
    pix: {
      fixedFeeValue: pixFee,
    },
    discount: {
      active: hasDiscount && discountTiers.length > 0,
      expiration: paymentCc.discountExpiration || undefined,
      tiers: discountTiers,
    },
  };
}

export function calculateCreditFees(
  baseValue: number,
  installments: number,
  fees: NormalizedAsaasFees,
  repassarTaxas: boolean,
  repassarAntecipacao: boolean
): {
  totalValue: number;
  installmentValue: number;
  processingFee: number;
  anticipationFee: number;
} {
  const i = Math.max(1, installments);
  if (baseValue <= 0) {
    return { totalValue: 0, installmentValue: 0, processingFee: 0, anticipationFee: 0 };
  }

  const activeTiers = fees.discount?.active && fees.discount.tiers.length > 0
    ? fees.discount.tiers
    : fees.creditCard.tiers;
  const tier = activeTiers.find((t) => i >= t.min && i <= t.max) || activeTiers[activeTiers.length - 1];
  
  const percentageStr = tier?.percentageFee ?? 0;
  
  const procPercent = repassarTaxas ? (percentageStr / 100) : 0;
  const fixedFee = repassarTaxas ? fees.creditCard.operationValue : 0;

  const taxaMensal = i === 1
    ? fees.creditCard.detachedMonthlyFeeValue
    : fees.creditCard.installmentMonthlyFeeValue;
    
  const antPercent = repassarAntecipacao ? (taxaMensal / 100) : 0;

  // Cálculo Exato de Gross Up (de Trás para Frente)
  // S = parcelas - (taxaMensalAntecipacao * parcelas * (parcelas + 1)) / 2
  // Gross = ((parcelas * (Base / S)) + Fixa) / (1 - ProcPercent)
  
  const S = i - (antPercent * i * (i + 1)) / 2;
  const grossValue = ((i * (baseValue / S)) + fixedFee) / (1 - procPercent);

  const totalValue = Math.round(grossValue * 100) / 100;
  const installmentValue = Math.round((totalValue / i) * 100) / 100;

  const actualProcFee = (totalValue * (percentageStr / 100)) + fees.creditCard.operationValue;
  const processingFee = repassarTaxas ? actualProcFee : 0;
  
  const netAfterProc = totalValue - actualProcFee;
  const parcelaNet = netAfterProc / i;
  let actualAnticipationFee = 0;
  
  if (taxaMensal > 0) {
    for (let j = 1; j <= i; j++) {
       actualAnticipationFee += parcelaNet * ((taxaMensal / 100) * j);
    }
  }
  const anticipationFee = repassarAntecipacao ? actualAnticipationFee : 0;

  return {
    totalValue,
    installmentValue,
    processingFee: Math.round(processingFee * 100) / 100,
    anticipationFee: Math.round(anticipationFee * 100) / 100,
  };
}

