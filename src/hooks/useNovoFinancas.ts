import { useState, useMemo, useEffect } from 'react';
import { ItemFinanceiro, GrupoPrincipal, StatusTransacao } from '@/types/financas';
import { getCurrentDateString } from '@/utils/dateUtils';
import { useAppContext } from '@/contexts/AppContext';
import { supabaseFinancialItemsService } from '@/services/FinancialItemsService';
import { useFinancialTransactionsSupabase, CreateTransactionParams } from '@/hooks/useFinancialTransactionsSupabase';

// Interface compatível com tipos existentes
interface ItemFinanceiroCompativel extends ItemFinanceiro {
  grupoPrincipal: GrupoPrincipal;
}

// Interface para transação compatível com o sistema existente
interface TransacaoCompativel {
  id: string;
  item_id: string;
  itemId: string;
  valor: number;
  data_vencimento: string;
  dataVencimento: string;
  status: StatusTransacao;
  observacoes?: string;
  userId: string;
  criadoEm: string;
  parentId?: string;
  parcela_atual?: number;
  parcela_total?: number;
  item: ItemFinanceiroCompativel;
}

export function useNovoFinancas() {
  // ============= INTEGRAÇÃO COM CARTÕES =============
  const { cartoes, adicionarCartao, atualizarCartao, removerCartao } = useAppContext();
  
  // ============= ESTADOS PRINCIPAIS =============
  
  const [itensFinanceiros, setItensFinanceiros] = useState<ItemFinanceiroCompativel[]>([]);

  const [filtroMesAno, setFiltroMesAno] = useState(() => {
    const hoje = getCurrentDateString();
    const [ano, mes] = hoje.split('-').map(Number);
    return { mes, ano };
  });

  // ============= INTEGRAÇÃO SUPABASE =============
  
  // Hook Supabase para transações
  const {
    transacoes: transacoesSupabase,
    transacoesPorGrupo: transacoesPorGrupoSupabase,
    isLoading,
    criarTransacao,
    atualizarTransacao: atualizarTransacaoSupabase,
    removerTransacao: removerTransacaoSupabase,
    marcarComoPago: marcarComoPagoSupabase,
    calcularMetricasPorGrupo
  } = useFinancialTransactionsSupabase(filtroMesAno);

  // Carregar itens financeiros do Supabase
  useEffect(() => {
    const loadItems = async () => {
      try {
        const items = await supabaseFinancialItemsService.getAllItems();
        const itemsCompativeis: ItemFinanceiroCompativel[] = items.map(item => ({
          ...item,
          grupoPrincipal: item.grupo_principal
        }));
        setItensFinanceiros(itemsCompativeis);
      } catch (error) {
        console.error('Erro ao carregar itens financeiros:', error);
      }
    };

    loadItems();
  }, []);

  // ============= GERENCIAMENTO DE ITENS FINANCEIROS =============
  
  const adicionarItemFinanceiro = async (nome: string, grupo: GrupoPrincipal) => {
    try {
      const novoItem = await supabaseFinancialItemsService.createItem(nome, grupo);
      const itemCompativel: ItemFinanceiroCompativel = {
        ...novoItem,
        grupoPrincipal: novoItem.grupo_principal
      };
      
      setItensFinanceiros(prev => [...prev, itemCompativel]);
      return novoItem;
    } catch (error) {
      console.error('Erro ao adicionar item financeiro:', error);
      throw error;
    }
  };

  const atualizarItemFinanceiro = async (id: string, updates: Partial<ItemFinanceiroCompativel>) => {
    try {
      const itemAtualizado = await supabaseFinancialItemsService.updateItem(id, {
        nome: updates.nome,
        ativo: updates.ativo
      });
      const itemCompativel: ItemFinanceiroCompativel = {
        ...itemAtualizado,
        grupoPrincipal: itemAtualizado.grupo_principal
      };
      
      setItensFinanceiros(prev => prev.map(item => item.id === id ? itemCompativel : item));
      return itemCompativel;
    } catch (error) {
      console.error('Erro ao atualizar item financeiro:', error);
      throw error;
    }
  };

  const removerItemFinanceiro = async (id: string) => {
    try {
      await supabaseFinancialItemsService.deleteItem(id);
      setItensFinanceiros(prev => prev.filter(item => item.id !== id));
    } catch (error) {
      console.error('Erro ao remover item financeiro:', error);
      throw error;
    }
  };

  // ============= PROCESSAMENTO DE DADOS PARA EXIBIÇÃO =============
  
  // Transações com informações dos itens - convertendo para formato compatível
  const transacoesComItens = useMemo((): TransacaoCompativel[] => {
    return transacoesSupabase.map(transacao => {
      // Verificação de segurança para transacao.itemId
      if (!transacao.item_id) {
        console.warn('Transação sem item_id:', transacao);
        return null;
      }
      
      const item = itensFinanceiros.find(item => item.id === transacao.item_id);
      const itemCompativel = item ? {
        ...item,
        grupoPrincipal: item.grupo_principal
      } : { 
        id: transacao.item_id, 
        nome: 'Item Removido', 
        grupo_principal: 'Despesa Variável' as GrupoPrincipal,
        grupoPrincipal: 'Despesa Variável' as GrupoPrincipal,
        userId: transacao.userId,
        ativo: false,
        criadoEm: getCurrentDateString()
      };
      
      return {
        id: transacao.id,
        item_id: transacao.item_id,
        itemId: transacao.item_id,
        valor: transacao.valor,
        data_vencimento: transacao.dataVencimento,
        dataVencimento: transacao.dataVencimento,
        status: transacao.status as StatusTransacao,
        observacoes: transacao.observacoes,
        userId: transacao.userId,
        criadoEm: transacao.criadoEm,
        parentId: transacao.parent_id,
        parcela_atual: transacao.parcela_atual,
        parcela_total: transacao.parcela_total,
        item: itemCompativel
      };
    }).filter(Boolean) as TransacaoCompativel[];
  }, [transacoesSupabase, itensFinanceiros]);

  // Filtrar transações por mês/ano (já feito no hook Supabase, mas mantemos compatibilidade)
  const transacoesFiltradas = useMemo(() => {
    return transacoesComItens;
  }, [transacoesComItens]);

  // Agrupar transações por grupo principal (já feito no hook Supabase)
  const transacoesPorGrupo = useMemo(() => {
    const grupos: Record<GrupoPrincipal, TransacaoCompativel[]> = {
      'Despesa Fixa': [],
      'Despesa Variável': [],
      'Investimento': [],
      'Receita Não Operacional': [],
      'Receita Operacional': []
    };

    transacoesFiltradas.forEach(transacao => {
      const grupo = transacao.item.grupoPrincipal;
      grupos[grupo].push(transacao);
    });

    return grupos;
  }, [transacoesFiltradas]);

  // ============= RESUMO FINANCEIRO =============
  
  const resumoFinanceiro = useMemo(() => {
    // Métricas por grupo
    const metricasDespesaFixa = calcularMetricasPorGrupo('Despesa Fixa');
    const metricasDespesaVariavel = calcularMetricasPorGrupo('Despesa Variável');
    const metricasInvestimento = calcularMetricasPorGrupo('Investimento');
    const metricasReceitaNaoOperacional = calcularMetricasPorGrupo('Receita Não Operacional');
    const metricasReceitaOperacional = calcularMetricasPorGrupo('Receita Operacional');

    // Totais de despesas
    const totalDespesaFixa = metricasDespesaFixa.total;
    const totalDespesaVariavel = metricasDespesaVariavel.total;
    const totalInvestimento = metricasInvestimento.total;

    // Totais de receitas
    const totalReceitaOperacional = metricasReceitaOperacional.total;
    const totalReceitaNaoOperacional = metricasReceitaNaoOperacional.total;

    const totalDespesas = totalDespesaFixa + totalDespesaVariavel + totalInvestimento;
    const totalReceitas = totalReceitaOperacional + totalReceitaNaoOperacional;

    return {
      totalDespesas,
      totalReceitas,
      lucroOperacional: totalReceitas - totalDespesas,
      despesaFixa: totalDespesaFixa,
      despesaVariavel: totalDespesaVariavel,
      investimento: totalInvestimento,
      receitaOperacional: totalReceitaOperacional,
      receitaNaoOperacional: totalReceitaNaoOperacional,
      pagoDespesaFixa: metricasDespesaFixa.pago,
      pagoDespesaVariavel: metricasDespesaVariavel.pago,
      pagoInvestimento: metricasInvestimento.pago,
      pagoReceitaOperacional: metricasReceitaOperacional.pago,
      pagoReceitaNaoOperacional: metricasReceitaNaoOperacional.pago
    };
  }, [calcularMetricasPorGrupo]);

  // ============= FUNÇÕES DE TRANSAÇÕES =============
  
  // Motor de criação de transações - adapter para hook Supabase
  const createTransactionEngine = async (input: any) => {
    try {
      console.log('createTransactionEngine chamado com dados:', input);
      
      const {
        itemId,
        valorTotal,
        dataPrimeiraOcorrencia,
        isRecorrente,
        isParcelado,
        numeroDeParcelas,
        observacoes,
        isValorFixo,
        cartaoCreditoId,
        dataCompra
      } = input;

      // Mapear para formato do Supabase
      const params: CreateTransactionParams = {
        item_id: itemId,
        valor: valorTotal,
        data_vencimento: dataPrimeiraOcorrencia,
        observacoes,
        isRecorrente: isRecorrente || false,
        isValorFixo: isValorFixo || false,
        isParcelado: isParcelado || false,
        parcela_total: numeroDeParcelas,
        credit_card_id: cartaoCreditoId,
        data_compra: dataCompra || dataPrimeiraOcorrencia
      };

      await criarTransacao(params);
      console.log('Transação criada com sucesso');
    } catch (error) {
      console.error('Erro ao criar transação:', error);
      throw error;
    }
  };

  // Compatibilidade com createRecurringTransactionsEngine
  const createRecurringTransactionsEngine = async (input: any) => {
    await createTransactionEngine({
      ...input,
      itemId: input.itemId,
      valorTotal: input.valor,
      dataPrimeiraOcorrencia: input.dataPrimeiraOcorrencia,
      isRecorrente: true,
      isValorFixo: input.isValorFixo ?? true,
      observacoes: input.observacoes
    });
  };

  const atualizarTransacao = async (id: string, dadosAtualizados: Partial<any>) => {
    try {
      await atualizarTransacaoSupabase(id, {
        valor: dadosAtualizados.valor,
        data_vencimento: dadosAtualizados.dataVencimento || dadosAtualizados.data_vencimento,
        status: dadosAtualizados.status,
        observacoes: dadosAtualizados.observacoes
      });
    } catch (error) {
      console.error('Erro ao atualizar transação:', error);
      throw error;
    }
  };

  const removerTransacao = async (id: string) => {
    try {
      await removerTransacaoSupabase(id);
    } catch (error) {
      console.error('Erro ao remover transação:', error);
      throw error;
    }
  };

  const marcarComoPago = async (id: string) => {
    try {
      await marcarComoPagoSupabase(id);
    } catch (error) {
      console.error('Erro ao marcar como pago:', error);
      throw error;
    }
  };

  // Função auxiliar para obter itens por grupo
  const obterItensPorGrupo = (grupo: GrupoPrincipal): ItemFinanceiroCompativel[] => {
    return itensFinanceiros.filter(item => item.grupo_principal === grupo && item.ativo);
  };

  // Funções de compatibilidade para chamadas antigas
  const adicionarTransacao = createTransactionEngine;
  const atualizarTransacaoCompativel = atualizarTransacao;

  // ============= EXPORTS =============
  
  return {
    // Estados
    filtroMesAno,
    setFiltroMesAno,
    itensFinanceiros,
    transacoes: transacoesComItens,
    transacoesPorGrupo,
    resumoFinanceiro,
    isLoading,
    
    // Funções de itens
    adicionarItemFinanceiro,
    removerItemFinanceiro,
    atualizarItemFinanceiro,
    obterItensPorGrupo,
    
    // Funções de transações
    adicionarTransacao,
    atualizarTransacao,
    atualizarTransacaoCompativel,
    removerTransacao,
    marcarComoPago,
    createTransactionEngine,
    createRecurringTransactionsEngine,
    calcularMetricasPorGrupo,
    
    // Integração com cartões
    cartoes,
    adicionarCartao,
    atualizarCartao,
    removerCartao
  };
}
