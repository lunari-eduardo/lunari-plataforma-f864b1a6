/**
 * Domain — moeda. SEMPRE numérico.
 * As actions/queries trafegam reais (number, 2 casas); centavos são utilitário
 * interno para comparação livre de float drift.
 */

/** Converte qualquer entrada (number, "R$ 1.234,56", "1234.56") em reais (number). */
export function toReais(input: unknown): number {
  if (input === null || input === undefined) return 0;
  if (typeof input === "number") return Number.isFinite(input) ? input : 0;
  if (typeof input === "string") {
    const cleaned = input.replace(/[^\d,.-]/g, "");
    // BRL: vírgula é decimal, ponto é milhar
    if (cleaned.includes(",")) {
      const normalized = cleaned.replace(/\./g, "").replace(",", ".");
      const n = parseFloat(normalized);
      return Number.isFinite(n) ? n : 0;
    }
    const n = parseFloat(cleaned);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

/** Reais → centavos inteiros, arredondamento bancário simples. */
export function toCentavos(reais: number): number {
  return Math.round((Number(reais) || 0) * 100);
}

/** Centavos → reais (number). */
export function fromCentavos(centavos: number): number {
  return (Number(centavos) || 0) / 100;
}

/** Formato BRL puro (sem React) — para tooltips/labels do domain. */
export function formatBRL(reais: number): string {
  const n = Number(reais) || 0;
  return `R$ ${n.toFixed(2).replace(".", ",")}`;
}
