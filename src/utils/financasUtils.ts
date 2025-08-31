/**
 * Utilitários otimizados para operações financeiras
 * Centraliza funções comuns e operações custosas
 */

// Cache para operações de formatação custosas
const formatCache = new Map<string, string>();

/**
 * Formatação de moeda com cache
 */
export function formatCurrencyOptimized(value: number): string {
  const key = `${value}`;
  
  if (formatCache.has(key)) {
    return formatCache.get(key)!;
  }
  
  const formatted = new Intl.NumberFormat('pt-BR', { 
    style: 'currency', 
    currency: 'BRL' 
  }).format(value);
  
  // Limitar cache para evitar vazamento de memória
  if (formatCache.size > 1000) {
    const firstKey = formatCache.keys().next().value;
    formatCache.delete(firstKey);
  }
  
  formatCache.set(key, formatted);
  return formatted;
}

/**
 * Agrupamento otimizado de transações por critério
 */
export function agruparTransacoes<T, K extends string | number>(
  items: T[], 
  getKey: (item: T) => K
): Map<K, T[]> {
  const grupos = new Map<K, T[]>();
  
  for (const item of items) {
    const key = getKey(item);
    const grupo = grupos.get(key) || [];
    grupo.push(item);
    grupos.set(key, grupo);
  }
  
  return grupos;
}

/**
 * Cálculo otimizado de métricas financeiras
 */
export function calcularMetricas(transacoes: any[]): {
  total: number;
  pago: number;
  agendado: number;
  faturado: number;
} {
  let total = 0;
  let pago = 0;
  let agendado = 0;
  let faturado = 0;
  
  // Único loop para todos os cálculos
  for (const transacao of transacoes) {
    const valor = Number(transacao.valor) || 0;
    total += valor;
    
    switch (transacao.status) {
      case 'Pago':
        pago += valor;
        break;
      case 'Agendado':
        agendado += valor;
        break;
      case 'Faturado':
        faturado += valor;
        break;
    }
  }
  
  return { total, pago, agendado, faturado };
}

/**
 * Debounce para operações custosas
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

/**
 * Filtro otimizado por data
 */
export function filtrarPorPeriodo(
  transacoes: any[],
  ano: number,
  mes?: number
): any[] {
  return transacoes.filter(transacao => {
    if (!transacao.dataVencimento) return false;
    
    const [anoTransacao, mesTransacao] = transacao.dataVencimento.split('-').map(Number);
    
    if (anoTransacao !== ano) return false;
    
    return mes ? mesTransacao === mes : true;
  });
}

/**
 * Ordenação otimizada por data
 */
export function ordenarPorData(transacoes: any[], crescente = true): any[] {
  return [...transacoes].sort((a, b) => {
    const dataA = new Date(a.dataVencimento || '1970-01-01').getTime();
    const dataB = new Date(b.dataVencimento || '1970-01-01').getTime();
    
    return crescente ? dataA - dataB : dataB - dataA;
  });
}