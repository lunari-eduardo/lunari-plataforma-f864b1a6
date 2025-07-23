
/**
 * Formats a number as currency (BRL)
 */
export function formatCurrency(value: number | string): string {
  // Convert string to number if needed
  const numValue = typeof value === 'string' 
    ? parseFloat(value.replace(/[^\d.,]/g, '').replace(',', '.')) 
    : value;

  return new Intl.NumberFormat('pt-BR', { 
    style: 'currency', 
    currency: 'BRL' 
  }).format(numValue);
}

/**
 * Parses a currency string to number
 */
export function parseCurrency(value: string): number {
  return parseFloat(value.replace(/[^\d.,]/g, '').replace(',', '.'));
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
 */
export function formatPercentage(value: number | null): string {
  if (value === null) return '0%';
  return `${value > 0 ? '+' : ''}${value.toFixed(1)}%`;
}
