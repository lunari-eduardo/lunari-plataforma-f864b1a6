/**
 * Utilities for currency formatting and calculations
 * Centralized currency handling for consistent formatting across the app
 * 
 * IMPORTANTE: Use APENAS estas funções para formatação monetária em todo o sistema
 * Padrão: R$ 1.000,00 (formato brasileiro)
 */

/**
 * Format value as Brazilian Real currency
 * Primary function - USE THIS EVERYWHERE
 * 
 * @example formatCurrency(1000) => "R$ 1.000,00"
 * @example formatCurrency(1234.56) => "R$ 1.234,56"
 */
export function formatCurrency(value: number | string): string {
  // Convert string to number if needed
  const numValue = typeof value === 'string' 
    ? parseFloat(value.replace(/[^\d.,-]/g, '').replace(',', '.')) 
    : value;

  // Handle invalid numbers
  if (isNaN(numValue)) return 'R$ 0,00';

  return new Intl.NumberFormat('pt-BR', { 
    style: 'currency', 
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(numValue);
}

/**
 * Alias for formatCurrency (legacy compatibility)
 * @deprecated Use formatCurrency instead
 */
export const formatarMoeda = formatCurrency;

/**
 * Parse currency string to number (for form inputs)
 * 
 * @example parseMoeda("R$ 1.234,56") => 1234.56
 * @example parseMoeda("1.234,56") => 1234.56
 */
export function parseMoeda(valorString: string): number {
  // Remove currency symbols, spaces, and thousands separators
  const numericValue = valorString
    .replace(/[R$\s.]/g, '')  // Remove R$, spaces, and dots (thousand separators)
    .replace(',', '.');        // Replace comma with dot for decimal
  
  return parseFloat(numericValue) || 0;
}

/**
 * Alias for parseMoeda
 */
export const parseCurrency = parseMoeda;

/**
 * Format value for input fields (without currency symbol)
 * 
 * @example formatarValorInput(1234.56) => "1234,56"
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

/**
 * Calculates percentage change between two values
 */
export function calculatePercentChange(current: number, previous: number): number | null {
  if (!previous || previous === 0) return null;
  return ((current - previous) / previous) * 100;
}

/**
 * Formats a percentage number
 * 
 * @example formatPercentage(15.5) => "+15.5%"
 * @example formatPercentage(-5.2) => "-5.2%"
 */
export function formatPercentage(value: number | null): string {
  if (value === null) return '0%';
  return `${value > 0 ? '+' : ''}${value.toFixed(1)}%`;
}