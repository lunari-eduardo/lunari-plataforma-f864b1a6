import type { FaixaPreco, RegrasCongeladas } from "./types";

/**
 * Finds the price tier for the given quantity
 * Exported for use in Edge Functions as well
 */
export function encontrarFaixaPreco(
  quantidade: number,
  faixas: FaixaPreco[],
): FaixaPreco | null {
  if (!faixas?.length || quantidade <= 0) return null;

  // Sort by min ascending
  const faixasOrdenadas = [...faixas].sort((a, b) => a.min - b.min);

  for (const faixa of faixasOrdenadas) {
    if (quantidade >= faixa.min && (faixa.max === null || quantidade <= faixa.max)) {
      return faixa;
    }
  }

  // If quantity exceeds all ranges, use the last one (highest tier)
  return faixasOrdenadas[faixasOrdenadas.length - 1] || null;
}

/**
 * Gets the unit price from a tier
 */
export function encontrarValorNaFaixa(quantidade: number, faixas: FaixaPreco[]): number {
  const faixa = encontrarFaixaPreco(quantidade, faixas);
  return faixa?.valor || 0;
}

/**
 * Gets the pricing model display name in Portuguese
 */
export function getModeloDisplayName(modelo: string): string {
  switch (modelo) {
    case "fixo":
      return "Preço Fixo";
    case "global":
      return "Tabela Global";
    case "categoria":
      return "Tabela por Categoria";
    default:
      return "Padrão";
  }
}

/**
 * Formats a price tier for display
 */
export function formatFaixaDisplay(faixa: FaixaPreco): string {
  if (faixa.max === null) {
    return `${faixa.min}+ fotos`;
  }
  if (faixa.min === faixa.max) {
    return `${faixa.min} foto${faixa.min > 1 ? "s" : ""}`;
  }
  return `${faixa.min}-${faixa.max} fotos`;
}

/**
 * Gets all available tiers from the frozen rules
 */
export function getFaixasFromRegras(regras: RegrasCongeladas | null | undefined): FaixaPreco[] {
  if (!regras?.precificacaoFotoExtra) return [];

  const precificacao = regras.precificacaoFotoExtra;

  if (precificacao.modelo === "global" && precificacao.tabelaGlobal?.faixas) {
    return precificacao.tabelaGlobal.faixas;
  }

  if (precificacao.modelo === "categoria" && precificacao.tabelaCategoria?.faixas) {
    return precificacao.tabelaCategoria.faixas;
  }

  return [];
}
