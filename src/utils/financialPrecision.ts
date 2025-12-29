/**
 * Utilitários para garantir precisão decimal em operações financeiras
 * Evita erros de ponto flutuante comuns em JavaScript
 */

/**
 * Arredonda valor para 2 casas decimais (padrão monetário)
 * Usa Math.round para evitar erros de precisão de ponto flutuante
 */
export function roundToTwoDecimals(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Converte string para número financeiro com precisão garantida de 2 casas decimais
 * Retorna 0 se o valor for inválido
 */
export function parseFinancialInput(value: string): number {
  const parsed = parseFloat(value);
  if (isNaN(parsed)) return 0;
  return roundToTwoDecimals(parsed);
}
