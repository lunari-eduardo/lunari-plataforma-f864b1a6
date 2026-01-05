/**
 * Financial utilities - Re-exports from currencyUtils
 * 
 * @deprecated This file is deprecated. Import from @/utils/currencyUtils instead.
 * This file exists only for backward compatibility.
 */

// Re-export all currency utilities from the consolidated module
export { 
  formatCurrency, 
  parseCurrency, 
  calculatePercentChange, 
  formatPercentage,
  formatarMoeda,
  parseMoeda,
  formatarValorInput,
  validarValorMonetario,
} from './currencyUtils';
