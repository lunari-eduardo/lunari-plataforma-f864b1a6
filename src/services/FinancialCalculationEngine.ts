/**
 * Motor de Cálculo Financeiro Centralizado
 * Única fonte da verdade para todos os cálculos financeiros da aplicação
 */

// Tipos para entrada da função
interface Produto {
  id: string;
  nome: string;
  valorUnitario: number;
  quantidade: number;
  tipo: 'manual' | 'incluso';
}

interface Pacote {
  id: string;
  nome: string;
  valorBase: number;
}

interface ItemFinanceiro {
  pacotePrincipal?: Pacote;
  pacotes?: Pacote[];
  produtosList?: Produto[];
  produtos?: Produto[];
  adicional?: number;
  desconto?: number;
  valorFotosExtra?: number;
  // Campos de compatibilidade
  valorTotalProduto?: number;
}

// Tipo de retorno padronizado
export interface CalculatedTotals {
  valorPacote: number;
  valorProdutosAdicionais: number;
  valorFotosExtra: number;
  valorAdicional: number;
  valorDesconto: number;
  totalGeral: number;
  detalhes: {
    produtosManuais: Produto[];
    produtosInclusos: Produto[];
    temPacote: boolean;
  };
}

/**
 * FUNÇÃO PRINCIPAL - MOTOR DE CÁLCULO FINANCEIRO
 * 
 * Esta é a única fonte da verdade para todos os cálculos financeiros.
 * Todos os componentes DEVEM usar esta função para garantir consistência.
 * 
 * REGRAS DE NEGÓCIO:
 * 1. valorPacote = valor base do pacote principal (ou 0 se não houver)
 * 2. valorProdutosAdicionais = soma de (preço * quantidade) APENAS de produtos manuais
 * 3. Produtos marcados como 'incluso' NÃO entram no cálculo do total
 * 4. valorFotosExtra = valor adicional de fotos
 * 5. totalGeral = pacote + produtos manuais + fotos extra + adicional - desconto
 */
export function calculateTotals(item: ItemFinanceiro): CalculatedTotals {
  // 1. VALOR DO PACOTE
  const pacote = item.pacotePrincipal || (item.pacotes && item.pacotes[0]);
  const valorPacote = pacote ? pacote.valorBase : 0;

  // 2. EXTRAIR LISTA DE PRODUTOS (com compatibilidade)
  const produtos = item.produtosList || item.produtos || [];

  // 3. SEPARAR PRODUTOS POR TIPO
  const produtosManuais = produtos.filter(p => p.tipo === 'manual');
  const produtosInclusos = produtos.filter(p => p.tipo === 'incluso');

  // 4. CALCULAR VALOR DOS PRODUTOS ADICIONAIS (APENAS MANUAIS)
  const valorProdutosAdicionais = produtosManuais.reduce((total, produto) => {
    return total + (produto.valorUnitario * produto.quantidade);
  }, 0);

  // 5. VALORES AUXILIARES
  const valorFotosExtra = item.valorFotosExtra || 0;
  const valorAdicional = item.adicional || 0;
  const valorDesconto = item.desconto || 0;

  // 6. CÁLCULO DO TOTAL GERAL
  const totalGeral = valorPacote + valorProdutosAdicionais + valorFotosExtra + valorAdicional - valorDesconto;

  // 7. RETORNAR OBJETO ESTRUTURADO
  return {
    valorPacote,
    valorProdutosAdicionais,
    valorFotosExtra,
    valorAdicional,
    valorDesconto,
    totalGeral,
    detalhes: {
      produtosManuais,
      produtosInclusos,
      temPacote: Boolean(pacote)
    }
  };
}

/**
 * Função auxiliar para formatar resumo financeiro
 */
export function formatFinancialSummary(totals: CalculatedTotals): string[] {
  const summary = [];
  
  if (totals.valorPacote > 0) {
    summary.push(`Pacote: R$ ${totals.valorPacote.toFixed(2).replace('.', ',')}`);
  }
  
  if (totals.valorProdutosAdicionais > 0) {
    summary.push(`Produtos: R$ ${totals.valorProdutosAdicionais.toFixed(2).replace('.', ',')}`);
  }
  
  if (totals.valorFotosExtra > 0) {
    summary.push(`Fotos Extra: R$ ${totals.valorFotosExtra.toFixed(2).replace('.', ',')}`);
  }
  
  if (totals.valorAdicional > 0) {
    summary.push(`Adicional: R$ ${totals.valorAdicional.toFixed(2).replace('.', ',')}`);
  }
  
  if (totals.valorDesconto > 0) {
    summary.push(`Desconto: -R$ ${totals.valorDesconto.toFixed(2).replace('.', ',')}`);
  }
  
  return summary;
}

/**
 * Função de validação para garantir integridade dos dados
 */
export function validateFinancialData(item: ItemFinanceiro): string[] {
  const errors = [];
  
  // Verificar se produtos inclusos têm valor zero
  const produtos = item.produtosList || item.produtos || [];
  const produtosInclusosComValor = produtos.filter(p => p.tipo === 'incluso' && p.valorUnitario > 0);
  
  if (produtosInclusosComValor.length > 0) {
    errors.push(`Produtos inclusos não podem ter valor: ${produtosInclusosComValor.map(p => p.nome).join(', ')}`);
  }
  
  // Verificar valores negativos
  if (item.adicional && item.adicional < 0) {
    errors.push('Valor adicional não pode ser negativo');
  }
  
  if (item.desconto && item.desconto < 0) {
    errors.push('Desconto não pode ser negativo');
  }
  
  return errors;
}