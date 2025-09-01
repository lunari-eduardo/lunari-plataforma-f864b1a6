/**
 * Hook para carregamento e processamento de dados do extrato
 */

import { useMemo, useCallback } from 'react';
import { LinhaExtrato, ExtratoTipo, ExtratoStatus } from '@/types/extrato';
import { FinancialEngine } from '@/services/FinancialEngine';
import { useNovoFinancas } from '@/hooks/useNovoFinancas';
import { useAppContext } from '@/contexts/AppContext';
import { storage, STORAGE_KEYS } from '@/utils/localStorage';
import {
  resolveClienteNome,
  getPagamentoEffectiveDate,
  getTransacaoEffectiveDate,
  convertPagamentoStatus
} from '@/utils/extratoUtils';

export function useExtratoData() {
  const { itensFinanceiros, cartoes } = useNovoFinancas();
  const { clientes } = useAppContext();

  // ============= FUNÇÃO DE RESOLUÇÃO DE CLIENTE =============
  const resolverNomeCliente = useCallback((session: any): string => {
    return resolveClienteNome(session, clientes);
  }, [clientes]);

  // ============= CARREGAMENTO DE TRANSAÇÕES FINANCEIRAS =============
  const transacoesFinanceiras = useMemo(() => {
    // TODO: [SUPABASE] Substituir por query Supabase com filtros otimizados
    // TODO: [SUPABASE] Implementar cache inteligente com invalidação automática
    return FinancialEngine.loadTransactions();
  }, []);

  // ============= CARREGAMENTO DE PAGAMENTOS DO WORKFLOW =============
  const pagamentosWorkflow = useMemo(() => {
    // TODO: [SUPABASE] Migrar para tabela dedicada de pagamentos
    // TODO: [SUPABASE] Implementar RLS para isolamento de dados por usuário
    const sessions = storage.load(STORAGE_KEYS.WORKFLOW_ITEMS, []);
    const pagamentos: any[] = [];
    const processedPayments = new Set(); // Para evitar duplicações
    
    sessions.forEach((session: any) => {
      if (session.pagamentos && Array.isArray(session.pagamentos)) {
        session.pagamentos.forEach((pagamento: any) => {
          // Criar chave única para o pagamento
          const paymentKey = `${session.id}_${pagamento.id || pagamento.valor}_${pagamento.dataVencimento || pagamento.data}`;
          
          // Só adicionar se não foi processado antes
          if (!processedPayments.has(paymentKey)) {
            processedPayments.add(paymentKey);
            pagamentos.push({
              ...pagamento,
              sessionId: session.id,
              clienteNome: resolverNomeCliente(session),
              projetoNome: session.nome || 'Projeto sem nome',
              categoriaId: session.categoriaId,
              origem: 'workflow',
              // ENRIQUECER COM DADOS DA SESSÃO
              sessionDate: session.data, // Data da sessão
              sessionDataCompleta: session.dataCompleta, // Data completa da sessão se existir
              sessionDataInicio: session.dataInicio // Data de início da sessão se existir
            });
          }
        });
      }
    });
    
    return pagamentos;
  }, [resolverNomeCliente]);

  // ============= CONVERSÃO PARA LINHAS DO EXTRATO =============
  const linhasExtrato = useMemo((): LinhaExtrato[] => {
    const linhas: LinhaExtrato[] = [];

    // 1. TRANSAÇÕES FINANCEIRAS
    transacoesFinanceiras.forEach(transacao => {
      const item = itensFinanceiros.find(i => i.id === transacao.itemId);
      const cartao = transacao.cartaoCreditoId ? cartoes.find(c => c.id === transacao.cartaoCreditoId) : null;
      
      // Usar data efetiva simplificada
      const dataEfetiva = getTransacaoEffectiveDate(transacao);

      // Determinar tipo (entrada/saída) baseado no grupo
      const tipo: ExtratoTipo = item?.grupo_principal === 'Receita Não Operacional' ? 'entrada' : 'saida';

      linhas.push({
        id: `fin_${transacao.id}`,
        data: dataEfetiva,
        tipo,
        descricao: item?.nome || 'Item removido',
        origem: cartao ? 'cartao' : 'financeiro',
        categoria: item?.grupo_principal,
        parcela: transacao.parcelaInfo,
        valor: transacao.valor,
        status: transacao.status as ExtratoStatus,
        observacoes: transacao.observacoes,
        cartao: cartao?.nome,
        referenciaId: transacao.id,
        referenciaOrigem: cartao ? 'cartao' : 'financeiro'
      });
    });

    // 2. PAGAMENTOS DO WORKFLOW (RECEITAS OPERACIONAIS)
    pagamentosWorkflow.forEach(pagamento => {
      // Usar a nova lógica de data efetiva
      const dataEfetiva = getPagamentoEffectiveDate(pagamento);
      
      // Pular se não há data efetiva
      if (!dataEfetiva) return;

      // Converter status para formato do extrato  
      const status = convertPagamentoStatus(pagamento);

      linhas.push({
        id: `wf_${pagamento.id}`,
        data: dataEfetiva,
        tipo: 'entrada',
        descricao: `Pagamento - ${pagamento.projetoNome}`,
        origem: 'workflow',
        cliente: pagamento.clienteNome,
        projeto: pagamento.projetoNome,
        parcela: (pagamento.numeroParcela && pagamento.totalParcelas) ? {
          atual: pagamento.numeroParcela,
          total: pagamento.totalParcelas
        } : null,
        valor: pagamento.valor,
        status,
        observacoes: pagamento.observacoes,
        referenciaId: pagamento.sessionId,
        referenciaOrigem: 'workflow'
      });
    });

    return linhas;
  }, [transacoesFinanceiras, pagamentosWorkflow, itensFinanceiros, cartoes]);

  return {
    linhasExtrato,
    transacoesFinanceiras,
    pagamentosWorkflow,
    itensFinanceiros,
    cartoes
  };
}