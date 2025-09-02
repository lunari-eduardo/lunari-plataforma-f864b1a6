/**
 * Utilities for currency formatting and calculations
 * Centralized currency handling for consistent formatting across the app
 */

/**
 * Format value as Brazilian Real currency
 */
export function formatarMoeda(valor: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(valor);
}

/**
 * Parse currency string to number (for form inputs)
 */
export function parseMoeda(valorString: string): number {
  // Remove currency symbols and convert to number
  const numericValue = valorString
    .replace(/[R$\s]/g, '')
    .replace(',', '.');
  
  return parseFloat(numericValue) || 0;
}

/**
 * Format value for input fields (without currency symbol)
 */
export function formatarValorInput(valor: number): string {
  return valor.toFixed(2).replace('.', ',');
}

/**
 * Validate if a monetary value is valid
 */
export function validarValorMonetario(valor: number): boolean {
  return !isNaN(valor) && valor >= 0 && isFinite(valor);
}