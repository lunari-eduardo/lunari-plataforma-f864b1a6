/**
 * Session Total Calculation Utilities
 * FASE 1: Centralized calculation function for session valor_total
 * Ensures consistent calculation across the entire system
 */

export interface SessionTotalComponents {
  valorBase: number;
  valorFotoExtra: number;
  valorProdutos: number;
  valorAdicional: number;
  desconto: number;
}

export interface ProductWithValue {
  nome: string;
  quantidade: number;
  valorUnitario: number;
  tipo: 'incluso' | 'manual';
}

/**
 * Calculate total value from manual products only
 * (products with tipo='manual' have valorUnitario > 0)
 */
export function calculateManualProductsTotal(products: ProductWithValue[]): number {
  if (!Array.isArray(products)) return 0;
  
  return products.reduce((total, product) => {
    // Only count manual products (tipo='manual' AND valorUnitario > 0)
    if (product.tipo === 'manual' && product.valorUnitario > 0) {
      return total + (product.quantidade * product.valorUnitario);
    }
    return total;
  }, 0);
}

/**
 * Calculate session total value
 * Formula: valor_base + valor_fotos_extras + valor_produtos_manuais + valor_adicional - desconto
 */
export function calculateSessionTotal(components: SessionTotalComponents): number {
  const {
    valorBase = 0,
    valorFotoExtra = 0,
    valorProdutos = 0,
    valorAdicional = 0,
    desconto = 0
  } = components;

  const total = valorBase + valorFotoExtra + valorProdutos + valorAdicional - desconto;
  
  // Ensure total is never negative
  return Math.max(0, total);
}

/**
 * Calculate session total from database row data
 */
export function calculateSessionTotalFromRow(row: {
  valor_total?: number;
  valor_total_foto_extra?: number;
  produtos_incluidos?: any[];
  valor_adicional?: number;
  desconto?: number;
}): number {
  // Get base value (current valor_total or 0)
  const valorBase = Number(row.valor_total) || 0;
  
  // Extra photos
  const valorFotoExtra = Number(row.valor_total_foto_extra) || 0;
  
  // Manual products
  const valorProdutos = calculateManualProductsTotal(row.produtos_incluidos || []);
  
  // Additional value
  const valorAdicional = Number(row.valor_adicional) || 0;
  
  // Discount
  const desconto = Number(row.desconto) || 0;

  return calculateSessionTotal({
    valorBase,
    valorFotoExtra,
    valorProdutos,
    valorAdicional,
    desconto
  });
}
