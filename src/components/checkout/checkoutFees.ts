import { calcularAntecipacao, calculateCreditFees } from '@/lib/anticipationUtils';
import type { AsaasCheckoutData, AccountFees } from './types';

export interface InstallmentOption {
  value: string;
  label: string;
  totalValue: number;
}

export function buildInstallmentOptions(
  data: AsaasCheckoutData,
  accountFees: AccountFees | null,
  feesLoading: boolean,
): {
  installmentOptions: InstallmentOption[];
  repassarAntecipacao: boolean;
} {
  const ireiAntecipar =
    data.ireiAntecipar ?? data.incluirTaxaAntecipacao ?? false;
  const repassarAntecipacao = ireiAntecipar
    ? (data.repassarTaxaAntecipacao ?? data.incluirTaxaAntecipacao ?? false)
    : false;
  const incluirAntecipacao = repassarAntecipacao;

  const installmentOptions: InstallmentOption[] = [];
  const maxParcelas = data.maxParcelas || 12;

  for (let i = 1; i <= maxParcelas; i++) {
    let totalComTaxas = data.valorTotal;
    let label = `${i}x de R$ ${(data.valorTotal / i).toFixed(2)}`;

    if (!data.absorverTaxa && accountFees?.creditCard) {
      const calc = calculateCreditFees(
        data.valorTotal,
        i,
        accountFees,
        true,
        incluirAntecipacao,
      );
      totalComTaxas = calc.totalValue;
      label = `${i}x de R$ ${(totalComTaxas / i).toFixed(2)}`;
      if (totalComTaxas > data.valorTotal) {
        label += ` (total R$ ${totalComTaxas.toFixed(2)})`;
      }
    } else if (!data.absorverTaxa && !accountFees && !feesLoading) {
      if (incluirAntecipacao) {
        const taxaMensal =
          i === 1
            ? (data.taxaAntecipacaoCreditoAvista ??
              data.taxaAntecipacaoPercentual ??
              0)
            : (data.taxaAntecipacaoCreditoParcelado ??
              data.taxaAntecipacaoPercentual ??
              0);
        if (taxaMensal > 0) {
          const { totalTaxa } = calcularAntecipacao(
            data.valorTotal,
            i,
            taxaMensal,
          );
          totalComTaxas = data.valorTotal + totalTaxa;
          label = `${i}x de R$ ${(totalComTaxas / i).toFixed(2)}`;
          if (totalTaxa > 0) {
            label += ` (total R$ ${totalComTaxas.toFixed(2)})`;
          }
        }
      }
    }

    installmentOptions.push({
      value: String(i),
      label,
      totalValue: totalComTaxas,
    });
  }

  return { installmentOptions, repassarAntecipacao };
}
