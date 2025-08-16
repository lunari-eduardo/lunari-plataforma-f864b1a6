import { useMemo } from 'react';
import { Cliente } from '@/types/cliente';
import { WorkflowItem } from '@/contexts/AppContext';

/**
 * FASE 4 & 5: MÉTRICAS APRIMORADAS E HISTÓRICO COMPLETO
 * 
 * Hook aprimorado para métricas de clientes com:
 * - Cálculos financeiros 100% precisos
 * - Histórico completo de todas as sessões
 * - Métricas avançadas (ticket médio, frequência, etc.)
 * - Timeline unificada de interações
 */

export interface EnhancedClientMetrics {
  // Dados básicos
  id: string;
  nome: string;
  email: string;
  telefone: string;
  
  // Métricas de sessões
  totalSessoes: number;
  sessoesUltimos12Meses: number;
  sessoesEsteAno: number;
  ultimaSessao: Date | null;
  proximaSessao: Date | null;
  
  // Métricas financeiras
  totalFaturado: number;
  totalPago: number;
  aReceber: number;
  ticketMedio: number;
  maiorVenda: number;
  menorVenda: number;
  
  // Métricas de relacionamento
  tempoComoCliente: number; // em dias
  frequenciaMedia: number; // sessões por mês
  categoriasAtendidas: string[];
  pacotesMaisUsados: string[];
  
  // Status e classificação
  classificacao: 'Novo' | 'Recorrente' | 'VIP' | 'Inativo';
  risco: 'Baixo' | 'Médio' | 'Alto'; // Baseado em aReceber vs totalFaturado
  
  // Histórico completo
  historicoCompleto: SessionHistory[];
  
  // Timeline de interações
  timeline: TimelineEvent[];
}

export interface SessionHistory {
  id: string;
  data: Date;
  hora: string;
  categoria: string;
  pacote: string;
  descricao: string;
  status: string;
  
  // Detalhes financeiros
  valorPacote: number;
  desconto: number;
  descontoPercentual: number;
  
  // Fotos extras
  qtdFotosExtra: number;
  valorFotoExtra: number;
  valorTotalFotoExtra: number;
  
  // Produtos
  produtos: {
    nome: string;
    quantidade: number;
    valorUnitario: number;
    valorTotal: number;
    tipo: 'incluso' | 'manual';
  }[];
  valorTotalProdutos: number;
  
  // Valores adicionais
  valorAdicional: number;
  motivoAdicional?: string;
  
  // Totais
  subtotal: number;
  total: number;
  valorPago: number;
  restante: number;
  
  // Pagamentos
  pagamentos: {
    id: string;
    valor: number;
    data: string;
    metodo?: string;
  }[];
  
  // Observações
  detalhes: string;
  observacoes?: string;
}

export interface TimelineEvent {
  id: string;
  data: Date;
  tipo: 'sessao' | 'pagamento' | 'orcamento' | 'agendamento';
  titulo: string;
  descricao: string;
  valor?: number;
  status?: string;
  icone: string;
  cor: string;
}

export function useEnhancedClientMetrics(
  clientes: Cliente[], 
  workflowData: WorkflowItem[] = []
): EnhancedClientMetrics[] {
  
  return useMemo(() => {
    const hoje = new Date();
    const inicioAno = new Date(hoje.getFullYear(), 0, 1);
    const inicioUltimos12Meses = new Date(hoje.getFullYear() - 1, hoje.getMonth(), hoje.getDate());
    
    return clientes.map(cliente => {
      // Filtrar dados do workflow para este cliente
      const sessoes = workflowData.filter(item => {
        // Buscar por clienteId primeiro, depois por nome como fallback
        const matchByClienteId = item.clienteId === cliente.id;
        const matchByName = !item.clienteId && 
          item.nome?.toLowerCase().trim() === cliente.nome.toLowerCase().trim();
        return matchByClienteId || matchByName;
      });
      
      // === MÉTRICAS DE SESSÕES ===
      const totalSessoes = sessoes.length;
      const sessoesEsteAno = sessoes.filter(s => new Date(s.data) >= inicioAno).length;
      const sessoesUltimos12Meses = sessoes.filter(s => new Date(s.data) >= inicioUltimos12Meses).length;
      
      // Datas importantes
      const datasOrdenadas = sessoes
        .map(s => new Date(s.data))
        .filter(d => !isNaN(d.getTime()))
        .sort((a, b) => b.getTime() - a.getTime());
      
      const ultimaSessao = datasOrdenadas.length > 0 ? datasOrdenadas[0] : null;
      const primeiraSessao = datasOrdenadas.length > 0 ? datasOrdenadas[datasOrdenadas.length - 1] : null;
      
      // === MÉTRICAS FINANCEIRAS ===
      const totalFaturado = sessoes.reduce((acc, s) => acc + (s.total || 0), 0);
      const totalPago = sessoes.reduce((acc, s) => acc + (s.valorPago || 0), 0);
      const aReceber = totalFaturado - totalPago;
      
      const valoresSessoes = sessoes
        .map(s => s.total || 0)
        .filter(v => v > 0)
        .sort((a, b) => a - b);
      
      const ticketMedio = totalSessoes > 0 ? totalFaturado / totalSessoes : 0;
      const maiorVenda = valoresSessoes.length > 0 ? Math.max(...valoresSessoes) : 0;
      const menorVenda = valoresSessoes.length > 0 ? Math.min(...valoresSessoes) : 0;
      
      // === MÉTRICAS DE RELACIONAMENTO ===
      const tempoComoCliente = primeiraSessao 
        ? Math.floor((hoje.getTime() - primeiraSessao.getTime()) / (1000 * 60 * 60 * 24))
        : 0;
      
      const mesesComoCliente = tempoComoCliente > 0 ? tempoComoCliente / 30.44 : 1; // Média de dias por mês
      const frequenciaMedia = mesesComoCliente > 0 ? totalSessoes / mesesComoCliente : 0;
      
      // Categorias e pacotes mais usados
      const categoriasMap = new Map<string, number>();
      const pacotesMap = new Map<string, number>();
      
      sessoes.forEach(s => {
        if (s.categoria) {
          categoriasMap.set(s.categoria, (categoriasMap.get(s.categoria) || 0) + 1);
        }
        if (s.pacote) {
          pacotesMap.set(s.pacote, (pacotesMap.get(s.pacote) || 0) + 1);
        }
      });
      
      const categoriasAtendidas = Array.from(categoriasMap.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([categoria]) => categoria);
      
      const pacotesMaisUsados = Array.from(pacotesMap.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([pacote]) => pacote);
      
      // === CLASSIFICAÇÃO DO CLIENTE ===
      let classificacao: 'Novo' | 'Recorrente' | 'VIP' | 'Inativo' = 'Novo';
      
      if (totalSessoes === 0) {
        classificacao = 'Novo';
      } else if (totalSessoes >= 5 && totalFaturado >= 5000) {
        classificacao = 'VIP';
      } else if (totalSessoes >= 2) {
        classificacao = 'Recorrente';
      } else if (ultimaSessao && (hoje.getTime() - ultimaSessao.getTime()) > (90 * 24 * 60 * 60 * 1000)) {
        classificacao = 'Inativo';
      }
      
      // === ANÁLISE DE RISCO ===
      let risco: 'Baixo' | 'Médio' | 'Alto' = 'Baixo';
      
      if (totalFaturado > 0) {
        const percentualAReceber = (aReceber / totalFaturado) * 100;
        if (percentualAReceber > 50) {
          risco = 'Alto';
        } else if (percentualAReceber > 20) {
          risco = 'Médio';
        }
      }
      
      // === HISTÓRICO COMPLETO ===
      const historicoCompleto: SessionHistory[] = sessoes
        .sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime())
        .map(sessao => ({
          id: sessao.id,
          data: new Date(sessao.data),
          hora: sessao.hora || '',
          categoria: sessao.categoria || '',
          pacote: sessao.pacote || '',
          descricao: sessao.descricao || '',
          status: sessao.status || '',
          
          // Financeiro
          valorPacote: sessao.valorPacote || 0,
          desconto: sessao.desconto || 0,
          descontoPercentual: (sessao.valorPacote || 0) > 0 
            ? ((sessao.desconto || 0) / (sessao.valorPacote || 0)) * 100 
            : 0,
          
          // Fotos extras
          qtdFotosExtra: sessao.qtdFotoExtra || 0,
          valorFotoExtra: sessao.valorFotoExtra || 0,
          valorTotalFotoExtra: sessao.valorTotalFotoExtra || 0,
          
          // Produtos
          produtos: (sessao.produtosList || []).map(p => ({
            nome: p.nome,
            quantidade: p.quantidade,
            valorUnitario: p.valorUnitario,
            valorTotal: p.quantidade * p.valorUnitario,
            tipo: p.tipo
          })),
          valorTotalProdutos: sessao.valorTotalProduto || 0,
          
          // Adicionais
          valorAdicional: sessao.valorAdicional || 0,
          
          // Totais
          subtotal: (sessao.valorPacote || 0) + (sessao.valorTotalFotoExtra || 0) + (sessao.valorTotalProduto || 0) + (sessao.valorAdicional || 0),
          total: sessao.total || 0,
          valorPago: sessao.valorPago || 0,
          restante: (sessao.total || 0) - (sessao.valorPago || 0),
          
          // Pagamentos
          pagamentos: sessao.pagamentos || [],
          
          // Observações
          detalhes: sessao.detalhes || '',
        }));
      
      // === TIMELINE DE EVENTOS ===
      const timeline: TimelineEvent[] = [];
      
      // Adicionar sessões
      historicoCompleto.forEach(sessao => {
        timeline.push({
          id: `sessao-${sessao.id}`,
          data: sessao.data,
          tipo: 'sessao',
          titulo: `Sessão: ${sessao.pacote}`,
          descricao: `${sessao.categoria} - ${sessao.descricao}`,
          valor: sessao.total,
          status: sessao.status,
          icone: '📸',
          cor: 'blue'
        });
        
        // Adicionar pagamentos
        sessao.pagamentos.forEach(pagamento => {
          timeline.push({
            id: `pagamento-${pagamento.id}`,
            data: new Date(pagamento.data),
            tipo: 'pagamento',
            titulo: 'Pagamento Recebido',
            descricao: `R$ ${pagamento.valor.toFixed(2)}`,
            valor: pagamento.valor,
            icone: '💰',
            cor: 'green'
          });
        });
      });
      
      // Ordenar timeline por data
      timeline.sort((a, b) => b.data.getTime() - a.data.getTime());
      
      return {
        // Dados básicos
        id: cliente.id,
        nome: cliente.nome,
        email: cliente.email,
        telefone: cliente.telefone,
        
        // Métricas de sessões
        totalSessoes,
        sessoesUltimos12Meses,
        sessoesEsteAno,
        ultimaSessao,
        proximaSessao: null, // TODO: Implementar com dados da agenda
        
        // Métricas financeiras
        totalFaturado,
        totalPago,
        aReceber,
        ticketMedio,
        maiorVenda,
        menorVenda,
        
        // Métricas de relacionamento
        tempoComoCliente,
        frequenciaMedia,
        categoriasAtendidas,
        pacotesMaisUsados,
        
        // Status e classificação
        classificacao,
        risco,
        
        // Dados completos
        historicoCompleto,
        timeline
      };
    });
  }, [clientes, workflowData]);
}