import { useMemo } from 'react';
import { Cliente, Orcamento } from '@/types/orcamentos';
import { WorkflowItem } from '@/contexts/AppContext';
import { Appointment } from '@/hooks/useAgenda';
import { generateSessionId } from '@/utils/workflowSessionsAdapter';

/**
 * SISTEMA DE HISTÓRICO UNIFICADO CORRIGIDO
 * 
 * Resolve os problemas identificados:
 * 1. Duplicação de entradas no histórico
 * 2. Valores incorretos (usa dados antigos em vez de dados do workflow)
 * 3. Falta de sessionId universal
 * 4. Reagendamento cria novos itens em vez de atualizar
 */

export interface UnifiedHistoryItem {
  sessionId: string; // ID único universal
  id: string; // ID específico (pode mudar com reagendamento)
  tipo: 'orcamento' | 'agendamento' | 'workflow' | 'projeto'; // Tipo do item
  
  // Dados básicos
  data: Date;
  hora: string;
  cliente: {
    id: string;
    nome: string;
  };
  
  // Dados do serviço
  categoria: string;
  pacote: string;
  descricao: string;
  status: string;
  
  // Dados financeiros (sempre os mais atualizados)
  valorOriginal: number; // Valor do orçamento/agendamento original
  valorFinal: number; // Valor final do workflow (se disponível)
  valorPago: number;
  valorRestante: number;
  
  // Metadados
  origem: 'orcamento' | 'agenda' | 'direct';
  dataUltimaAtualizacao: Date;
  
  // Dados completos para drill-down
  dadosCompletos: {
    orcamento?: Orcamento;
    agendamento?: Appointment;
    workflow?: WorkflowItem;
  };
  
  // Timeline de mudanças
  timeline: {
    data: Date;
    acao: string;
    detalhes: string;
    valorAnterior?: number;
    valorNovo?: number;
  }[];
}

export function useUnifiedClientHistory(
  cliente: Cliente,
  orcamentos: Orcamento[],
  agendamentos: Appointment[],
  workflowItems: WorkflowItem[]
): UnifiedHistoryItem[] {
  
  return useMemo(() => {
    if (!cliente) return [];
    
    console.log('🔍 NOVO SISTEMA DE HISTÓRICO UNIFICADO:', {
      clienteId: cliente.id,
      clienteNome: cliente.nome,
      orcamentos: orcamentos.length,
      agendamentos: agendamentos.length,
      workflowItems: workflowItems.length
    });

    // Mapa de projetos por sessionId
    const projetosPorSessionId = new Map<string, UnifiedHistoryItem>();
    
    // FASE 1: Processar orçamentos (base dos projetos)
    const orcamentosDoCliente = orcamentos.filter(orc => {
      const nomeOrcamento = typeof orc.cliente === 'string' ? orc.cliente : orc.cliente?.nome;
      return nomeOrcamento?.toLowerCase().trim() === cliente.nome?.toLowerCase().trim();
    });
    
    orcamentosDoCliente.forEach(orcamento => {
      // Gerar sessionId baseado no orçamento (normalizado)
      const sessionId = generateSessionId(`orc-${orcamento.id}`);
      
      const projeto: UnifiedHistoryItem = {
        sessionId,
        id: orcamento.id,
        tipo: 'orcamento',
        data: new Date(orcamento.data),
        hora: orcamento.hora || '',
        cliente: {
          id: cliente.id,
          nome: cliente.nome
        },
        categoria: orcamento.categoria,
        pacote: orcamento.pacotePrincipal?.nome || orcamento.categoria,
        descricao: orcamento.descricao || `Orçamento - ${orcamento.categoria}`,
        status: orcamento.status,
        valorOriginal: orcamento.valorFinal || 0,
        valorFinal: orcamento.valorFinal || 0,
        valorPago: 0, // Orçamentos não têm valor pago
        valorRestante: orcamento.valorFinal || 0,
        origem: 'orcamento',
        dataUltimaAtualizacao: new Date(orcamento.data),
        dadosCompletos: {
          orcamento
        },
        timeline: [{
          data: new Date(orcamento.data),
          acao: 'Orçamento Criado',
          detalhes: `Orçamento de ${orcamento.categoria} criado`,
          valorNovo: orcamento.valorFinal
        }]
      };
      
      projetosPorSessionId.set(sessionId, projeto);
    });
    
    // FASE 2: Processar agendamentos (podem atualizar projetos existentes)
    const agendamentosDoCliente = agendamentos.filter(agendamento => 
      agendamento.client?.toLowerCase().trim() === cliente.nome?.toLowerCase().trim()
    );
    
    agendamentosDoCliente.forEach(agendamento => {
      // Normalizar sessionId (determinístico)
      const sessionId = agendamento.orcamentoId
        ? generateSessionId(`orc-${agendamento.orcamentoId}`)
        : generateSessionId(`agenda-${agendamento.id}`);
      
      const projetoExistente = projetosPorSessionId.get(sessionId);
      
      if (projetoExistente) {
        // ATUALIZAR PROJETO EXISTENTE (orçamento que virou agendamento)
        projetoExistente.tipo = 'projeto'; // Mudou de orçamento para projeto
        projetoExistente.data = agendamento.date; // Data do agendamento
        projetoExistente.hora = agendamento.time;
        projetoExistente.status = agendamento.status;
        projetoExistente.dadosCompletos.agendamento = agendamento;
        projetoExistente.dataUltimaAtualizacao = agendamento.date;
        
        // Adicionar à timeline
        projetoExistente.timeline.push({
          data: agendamento.date,
          acao: 'Agendamento Confirmado',
          detalhes: `Orçamento transformado em agendamento para ${agendamento.time}`,
        });
      } else {
        // NOVO AGENDAMENTO DIRETO
        const novoProjeto: UnifiedHistoryItem = {
          sessionId,
          id: agendamento.id,
          tipo: 'agendamento',
          data: agendamento.date,
          hora: agendamento.time,
          cliente: {
            id: cliente.id,
            nome: cliente.nome
          },
          categoria: agendamento.type || '',
          pacote: agendamento.type || '',
          descricao: agendamento.description || `Agendamento - ${agendamento.type}`,
          status: agendamento.status,
          valorOriginal: agendamento.paidAmount || 0,
          valorFinal: agendamento.paidAmount || 0,
          valorPago: agendamento.paidAmount || 0,
          valorRestante: 0,
          origem: 'agenda',
          dataUltimaAtualizacao: agendamento.date,
          dadosCompletos: {
            agendamento
          },
          timeline: [{
            data: agendamento.date,
            acao: 'Agendamento Criado',
            detalhes: `Agendamento direto de ${agendamento.type}`,
            valorNovo: agendamento.paidAmount || 0
          }]
        };
        
        projetosPorSessionId.set(sessionId, novoProjeto);
      }
    });
    
    // FASE 3: Processar workflow items (DADOS FINANCEIROS AUTORITATIVOS)
    const workflowDoCliente = workflowItems.filter(item => {
      const matchByClienteId = item.clienteId === cliente.id;
      const matchByName = !item.clienteId && 
        item.nome?.toLowerCase().trim() === cliente.nome?.toLowerCase().trim();
      return matchByClienteId || matchByName;
    });
    
    workflowDoCliente.forEach(workflowItem => {
      // Normalizar sessionId a partir do ID sempre que possível (evita duplicações)
      let sessionId: string;
      if (workflowItem.id?.startsWith('orcamento-')) {
        const orcamentoId = workflowItem.id.replace('orcamento-', '');
        sessionId = generateSessionId(`orc-${orcamentoId}`);
      } else if (workflowItem.id?.startsWith('agenda-')) {
        sessionId = generateSessionId(workflowItem.id);
      } else if (workflowItem.sessionId?.startsWith('session-')) {
        sessionId = workflowItem.sessionId;
      } else {
        sessionId = generateSessionId(workflowItem.sessionId || workflowItem.id);
      }
      
      const projetoExistente = projetosPorSessionId.get(sessionId);
      
      if (projetoExistente) {
        // ATUALIZAR COM DADOS FINANCEIROS DO WORKFLOW (AUTORITATIVOS)
        const valorAnterior = projetoExistente.valorFinal;
        
        projetoExistente.tipo = 'projeto'; // Evoluiu para projeto completo
        projetoExistente.valorFinal = workflowItem.total || 0;
        projetoExistente.valorPago = workflowItem.valorPago || 0;
        projetoExistente.valorRestante = (workflowItem.total || 0) - (workflowItem.valorPago || 0);
        projetoExistente.status = workflowItem.status;
        projetoExistente.dadosCompletos.workflow = workflowItem;
        projetoExistente.dataUltimaAtualizacao = new Date();
        
        // Adicionar mudanças financeiras à timeline
        if (valorAnterior !== workflowItem.total) {
          projetoExistente.timeline.push({
            data: new Date(),
            acao: 'Valor Atualizado',
            detalhes: 'Valores financeiros atualizados no workflow',
            valorAnterior,
            valorNovo: workflowItem.total || 0
          });
        }
        
        // Adicionar pagamentos à timeline
        workflowItem.pagamentos?.forEach(pagamento => {
          projetoExistente.timeline.push({
            data: new Date(pagamento.data),
            acao: 'Pagamento Recebido',
            detalhes: `Pagamento de R$ ${pagamento.valor.toFixed(2)}`,
            valorNovo: pagamento.valor
          });
        });
        
      } else {
        // WORKFLOW ÓRFÃO (sem orçamento/agendamento correspondente)
        const novoProjeto: UnifiedHistoryItem = {
          sessionId,
          id: workflowItem.id,
          tipo: 'workflow',
          data: new Date(workflowItem.data),
          hora: workflowItem.hora,
          cliente: {
            id: cliente.id,
            nome: cliente.nome
          },
          categoria: workflowItem.categoria,
          pacote: workflowItem.pacote,
          descricao: workflowItem.descricao || workflowItem.pacote,
          status: workflowItem.status,
          valorOriginal: workflowItem.total || 0,
          valorFinal: workflowItem.total || 0,
          valorPago: workflowItem.valorPago || 0,
          valorRestante: (workflowItem.total || 0) - (workflowItem.valorPago || 0),
          origem: workflowItem.fonte === 'orcamento' ? 'orcamento' : 'agenda',
          dataUltimaAtualizacao: new Date(),
          dadosCompletos: {
            workflow: workflowItem
          },
          timeline: [{
            data: new Date(workflowItem.data),
            acao: 'Sessão de Trabalho',
            detalhes: `Sessão de ${workflowItem.pacote}`,
            valorNovo: workflowItem.total || 0
          }]
        };
        
        projetosPorSessionId.set(sessionId, novoProjeto);
      }
    });
    
    // Ordenar timeline de cada projeto
    projetosPorSessionId.forEach(projeto => {
      projeto.timeline.sort((a, b) => a.data.getTime() - b.data.getTime());
    });
    
    // Retornar histórico ordenado por data (mais recente primeiro) com deduplicação defensiva
    const baseHistorico = Array.from(projetosPorSessionId.values());

    // Deduplicação por chave de negócio para evitar "agendamento fantasma"
    const tipoRank: Record<UnifiedHistoryItem['tipo'], number> = {
      orcamento: 0,
      agendamento: 1,
      workflow: 2,
      projeto: 3,
    };

    const dedupMap = new Map<string, UnifiedHistoryItem>();

    for (const item of baseHistorico) {
      const chave = `${item.cliente.id}|${item.data.toISOString().slice(0,10)}|${item.hora}|${(item.pacote || item.categoria || '').toLowerCase().trim()}`;
      const existente = dedupMap.get(chave);
      if (!existente) {
        dedupMap.set(chave, item);
      } else {
        const rNovo = tipoRank[item.tipo];
        const rExistente = tipoRank[existente.tipo];
        if (rNovo > rExistente) {
          dedupMap.set(chave, item);
        } else if (rNovo === rExistente) {
          const hasWorkflowNovo = Boolean(item.dadosCompletos.workflow);
          const hasWorkflowExistente = Boolean(existente.dadosCompletos.workflow);
          if (hasWorkflowNovo && !hasWorkflowExistente) {
            dedupMap.set(chave, item);
          } else if (item.dataUltimaAtualizacao.getTime() > existente.dataUltimaAtualizacao.getTime()) {
            dedupMap.set(chave, item);
          }
        }
      }
    }

    const historicoUnificado = Array.from(dedupMap.values())
      .sort((a, b) => b.dataUltimaAtualizacao.getTime() - a.dataUltimaAtualizacao.getTime());
    
    console.log('✅ HISTÓRICO UNIFICADO CRIADO:', {
      total: historicoUnificado.length,
      orcamentos: historicoUnificado.filter(h => h.tipo === 'orcamento').length,
      agendamentos: historicoUnificado.filter(h => h.tipo === 'agendamento').length,
      projetos: historicoUnificado.filter(h => h.tipo === 'projeto').length,
      workflows: historicoUnificado.filter(h => h.tipo === 'workflow').length,
      totalFaturado: historicoUnificado.reduce((acc, h) => acc + h.valorFinal, 0),
      totalPago: historicoUnificado.reduce((acc, h) => acc + h.valorPago, 0)
    });
    
    return historicoUnificado;
    
  }, [cliente, orcamentos, agendamentos, workflowItems]);
}