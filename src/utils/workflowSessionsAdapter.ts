import { WorkflowItem, ProdutoWorkflow } from '@/contexts/AppContext';
import { parseDateFromStorage } from '@/utils/dateUtils';

/**
 * ADAPTADOR BIDIRECIONAL: Converte entre WorkflowItem e formato workflow_sessions
 * Garante compatibilidade total entre os dois formatos de dados
 */

// Função para converter valores monetários formatados para números
export const parseMonetaryValue = (value: string | number): number => {
  if (typeof value === 'number') return value;
  if (!value || typeof value !== 'string') return 0;
  
  // Remove "R$", espaços, pontos (milhares) e substitui vírgula por ponto
  const cleanValue = value
    .replace(/R\$\s*/g, '')
    .replace(/\./g, '')
    .replace(',', '.')
    .trim();
  
  const parsed = parseFloat(cleanValue);
  return isNaN(parsed) ? 0 : parsed;
};

// Função para formatar números para strings monetárias
export const formatMonetaryValue = (value: number): string => {
  if (typeof value !== 'number' || isNaN(value) || value === 0) return '';
  return `R$ ${value.toFixed(2).replace('.', ',')}`;
};

// Função para gerar sessionId único baseado no ID original
export const generateSessionId = (originalId: string): string => {
  // Se já é um sessionId válido, retornar
  if (originalId.startsWith('session-')) return originalId;
  
  // Se começa com 'orcamento-', extrair o ID real do orçamento
  if (originalId.startsWith('orcamento-')) {
    return `session-orc-${originalId.replace('orcamento-', '')}`;
  }
  
  // Para agendamentos e outros, criar sessionId baseado no ID
  return `session-${originalId}`;
};

/**
 * Converte de WorkflowItem para formato workflow_sessions
 */
export function workflowItemToSession(item: WorkflowItem): any {
  return {
    id: item.id,
    sessionId: item.sessionId || generateSessionId(item.id), // Gerar sessionId se não existir
    data: item.data,
    hora: item.hora || '',
    nome: item.nome || '',
    whatsapp: item.whatsapp || '',
    email: item.email || '',
    descricao: item.descricao || '',
    status: item.status || '',
    categoria: item.categoria || '',
    pacote: item.pacote || '',
    valorPacote: formatMonetaryValue(item.valorPacote || 0),
    desconto: item.desconto || 0,
    valorFotoExtra: formatMonetaryValue(item.valorFotoExtra || 0),
    qtdFotosExtra: item.qtdFotoExtra || 0,
    valorTotalFotoExtra: formatMonetaryValue(item.valorTotalFotoExtra || 0),
    produto: item.produto || '',
    qtdProduto: item.qtdProduto || 0,
    valorTotalProduto: formatMonetaryValue(item.valorTotalProduto || 0),
    produtosList: item.produtosList || [],
    valorAdicional: formatMonetaryValue(item.valorAdicional || 0),
    detalhes: item.detalhes || '',
    valor: formatMonetaryValue(item.total || 0),
    total: formatMonetaryValue(item.total || 0),
    valorPago: formatMonetaryValue(item.valorPago || 0),
    restante: formatMonetaryValue(item.restante || 0),
    pagamentos: item.pagamentos || [],
    fonte: item.fonte || 'agenda',
    dataOriginal: item.dataOriginal,
    // Campos específicos do workflow
    valorFinalAjustado: item.valorFinalAjustado,
    valorOriginalOrcamento: item.valorOriginalOrcamento,
    percentualAjusteOrcamento: item.percentualAjusteOrcamento,
    regrasDePrecoFotoExtraCongeladas: item.regrasDePrecoFotoExtraCongeladas,
    clienteId: item.clienteId
  };
}

/**
 * Converte de formato workflow_sessions para WorkflowItem
 */
export function sessionToWorkflowItem(session: any): WorkflowItem {
  const valorPacote = parseMonetaryValue(session.valorPacote || session.valor);
  const valorPago = parseMonetaryValue(session.valorPago);
  const total = parseMonetaryValue(session.total || session.valor);
  
  return {
    id: session.id,
    sessionId: session.sessionId || generateSessionId(session.id), // Gerar sessionId se não existir
    data: session.data,
    hora: session.hora || '',
    nome: session.nome || '',
    whatsapp: session.whatsapp || '',
    email: session.email || '',
    descricao: session.descricao || '',
    status: session.status || '',
    categoria: session.categoria || '',
    pacote: session.pacote || '',
    valorPacote: valorPacote,
    desconto: session.desconto || 0,
    valorFotoExtra: parseMonetaryValue(session.valorFotoExtra),
    qtdFotoExtra: session.qtdFotosExtra || 0,
    valorTotalFotoExtra: parseMonetaryValue(session.valorTotalFotoExtra),
    produto: session.produto || '',
    qtdProduto: session.qtdProduto || 0,
    valorTotalProduto: parseMonetaryValue(session.valorTotalProduto),
    produtosList: (session.produtosList || []).map((p: any) => ({
      nome: p.nome,
      quantidade: p.quantidade,
      valorUnitario: p.valorUnitario,
      tipo: (p.tipo === 'incluso' || p.tipo === 'manual') ? p.tipo : 'manual' as const
    })),
    valorAdicional: parseMonetaryValue(session.valorAdicional),
    detalhes: session.detalhes || '',
    total: total,
    valorPago: valorPago,
    restante: total - valorPago,
    pagamentos: session.pagamentos || [],
    fonte: session.fonte || 'agenda',
    dataOriginal: session.dataOriginal ? new Date(session.dataOriginal) : parseDateFromStorage(session.data),
    // Campos específicos do workflow
    valorFinalAjustado: session.valorFinalAjustado,
    valorOriginalOrcamento: session.valorOriginalOrcamento,
    percentualAjusteOrcamento: session.percentualAjusteOrcamento,
    regrasDePrecoFotoExtraCongeladas: session.regrasDePrecoFotoExtraCongeladas,
    clienteId: session.clienteId
  };
}

/**
 * Carrega WorkflowItems diretamente de workflow_sessions
 */
export function loadWorkflowItemsFromSessions(): WorkflowItem[] {
  try {
    const sessions = JSON.parse(localStorage.getItem('workflow_sessions') || '[]');
    return sessions.map(sessionToWorkflowItem);
  } catch (error) {
    console.error('❌ Erro ao carregar workflow_sessions:', error);
    return [];
  }
}

/**
 * Salva WorkflowItems no formato workflow_sessions
 */
export function saveWorkflowItemsToSessions(items: WorkflowItem[]): void {
  try {
    const sessions = items.map(workflowItemToSession);
    localStorage.setItem('workflow_sessions', JSON.stringify(sessions));
  } catch (error) {
    console.error('❌ Erro ao salvar workflow_sessions:', error);
  }
}