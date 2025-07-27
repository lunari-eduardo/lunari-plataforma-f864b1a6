/**
 * Motor de Cálculo Financeiro Centralizado
 * Única fonte da verdade para todos os cálculos financeiros da aplicação
 */

// Nova estrutura de dados baseada na arquitetura refatorada
interface PacotePrincipalCalculation {
  pacoteId: string;
  nome: string;
  valorCongelado: number;
  produtosIncluidos?: {
    produtoId: string;
    nome: string;
    quantidade: number;
    valorUnitarioCongelado: number;
    tipo: 'incluso';
  }[];
}

interface ProdutoAdicionalCalculation {
  produtoId: string;
  nome: string;
  quantidade: number;
  valorUnitarioCongelado: number;
  tipo: 'manual';
}

// Interface principal para cálculos (nova arquitetura)
interface ItemFinanceiroNovo {
  pacotePrincipal?: PacotePrincipalCalculation;
  produtosAdicionais?: ProdutoAdicionalCalculation[];
  valorFotosExtra?: number;
  valorAdicional?: number;
  valorDesconto?: number;
}

// Tipos de compatibilidade com sistema antigo
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
  valorBase?: number;
  valor_base?: number;
  valorVenda?: number;
  valor?: number;
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
 * FUNÇÃO PRINCIPAL - MOTOR DE CÁLCULO FINANCEIRO (NOVA ARQUITETURA)
 * 
 * Esta é a única fonte da verdade para todos os cálculos financeiros.
 * Todos os componentes DEVEM usar esta função para garantir consistência.
 * 
 * REGRAS DE NEGÓCIO:
 * 1. valorPacote = valor congelado do pacote principal
 * 2. valorProdutosAdicionais = soma de produtos manuais (valor congelado * quantidade)
 * 3. Produtos inclusos no pacote NÃO entram no cálculo do total
 * 4. totalGeral = pacote + produtos manuais + fotos extra + adicional - desconto
 */
export function calculateTotalsNew(item: ItemFinanceiroNovo): CalculatedTotals {
  // 1. VALOR DO PACOTE (valor congelado)
  const valorPacote = item.pacotePrincipal?.valorCongelado || 0;

  // 2. VALOR DOS PRODUTOS ADICIONAIS (apenas manuais, valores congelados)
  const valorProdutosAdicionais = item.produtosAdicionais?.reduce((total, produto) => {
    return total + (produto.valorUnitarioCongelado * produto.quantidade);
  }, 0) || 0;

  // 3. PRODUTOS INCLUSOS (para detalhes, não somam ao total)
  const produtosInclusos = item.pacotePrincipal?.produtosIncluidos?.map(p => ({
    id: p.produtoId,
    nome: p.nome,
    valorUnitario: 0, // Sempre 0 para produtos inclusos
    quantidade: p.quantidade,
    tipo: 'incluso' as const
  })) || [];

  // 4. PRODUTOS MANUAIS (para detalhes)
  const produtosManuais = item.produtosAdicionais?.map(p => ({
    id: p.produtoId,
    nome: p.nome,
    valorUnitario: p.valorUnitarioCongelado,
    quantidade: p.quantidade,
    tipo: 'manual' as const
  })) || [];

  // 5. VALORES AUXILIARES
  const valorFotosExtra = item.valorFotosExtra || 0;
  const valorAdicional = item.valorAdicional || 0;
  const valorDesconto = item.valorDesconto || 0;

  // 6. CÁLCULO DO TOTAL GERAL
  const totalGeral = valorPacote + valorProdutosAdicionais + valorFotosExtra + valorAdicional - valorDesconto;

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
      temPacote: Boolean(item.pacotePrincipal)
    }
  };
}

/**
 * FUNÇÃO DE COMPATIBILIDADE - MOTOR DE CÁLCULO FINANCEIRO (SISTEMA ANTIGO)
 * 
 * Mantém compatibilidade com dados existentes enquanto migração não estiver completa.
 */
export function calculateTotals(item: ItemFinanceiro): CalculatedTotals {
  // Verificar se é dados da nova estrutura disfarçados
  if ((item as any).pacotePrincipal?.valorCongelado !== undefined) {
    return calculateTotalsNew(item as any);
  }

  // 1. VALOR DO PACOTE (compatibilidade)
  const pacote = item.pacotePrincipal || (item.pacotes && item.pacotes[0]);
  const valorPacote = pacote ? (pacote.valorBase || pacote.valorVenda || pacote.valor_base || pacote.valor || 0) : 0;

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