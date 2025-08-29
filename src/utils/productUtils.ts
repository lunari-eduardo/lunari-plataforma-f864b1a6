/**
 * Utilities for Product Data Normalization and Management
 * Handles different product data formats across the system
 */

export interface NormalizedProduct {
  id: string;
  nome: string;
  custo: number;
  valorVenda: number;
  categoria?: string;
}

/**
 * Normalizes product data from different sources and formats
 */
export const normalizeProductData = (produto: any): NormalizedProduct => {
  console.log('🔧 [ProductUtils] Normalizando produto:', produto);
  
  const normalized: NormalizedProduct = {
    id: produto.id || produto.uuid || `produto_${Date.now()}_${Math.random()}`,
    nome: produto.nome || produto.name || '',
    custo: Number(produto.preco_custo || produto.precocusto || produto.custo || 0),
    valorVenda: Number(produto.preco_venda || produto.precovenda || produto.valorVenda || produto.valor || 0),
    categoria: produto.categoria || produto.category || undefined
  };
  
  console.log('✅ [ProductUtils] Produto normalizado:', normalized);
  return normalized;
};

/**
 * Validates if a product has the minimum required data
 */
export const isValidProduct = (produto: any): boolean => {
  const isValid = produto && 
    typeof produto === 'object' && 
    produto.nome && 
    produto.nome.trim() !== '';
  
  console.log('🔍 [ProductUtils] Validação do produto:', { produto, isValid });
  return isValid;
};

/**
 * Filters and normalizes a list of products
 */
export const processProductList = (produtos: any[]): NormalizedProduct[] => {
  console.log('📊 [ProductUtils] Processando lista de produtos:', produtos.length);
  
  try {
    const processed = produtos
      .filter(isValidProduct)
      .map(normalizeProductData);
    
    console.log('✅ [ProductUtils] Produtos processados:', processed.length);
    return processed;
  } catch (error) {
    console.error('❌ [ProductUtils] Erro no processamento:', error);
    return [];
  }
};

/**
 * Debug function to log product data structure
 */
export const debugProductData = (produtos: any[], context: string = 'Unknown') => {
  console.group(`🔍 [ProductUtils] Debug - ${context}`);
  console.log('📊 Total de produtos:', produtos.length);
  
  if (produtos.length > 0) {
    console.log('📋 Exemplo de produto (primeiro):', produtos[0]);
    console.log('🔑 Chaves disponíveis:', Object.keys(produtos[0] || {}));
    
    // Check data variations
    const variations = produtos.slice(0, 3).map(p => ({
      id: p.id || p.uuid,
      nome: p.nome || p.name,
      custo: p.preco_custo || p.precocusto || p.custo,
      venda: p.preco_venda || p.precovenda || p.valorVenda || p.valor
    }));
    
    console.table(variations);
  }
  
  console.groupEnd();
};