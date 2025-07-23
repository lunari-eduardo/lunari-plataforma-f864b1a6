import { useState, useMemo, useEffect } from 'react';
import { ItemFinanceiro, GrupoPrincipal, StatusTransacao } from '@/types/financas';
import { storage } from '@/utils/localStorage';
import { getCurrentDateString } from '@/utils/dateUtils';
import { 
  FinancialEngine, 
  FinancialTransaction, 
  RecurringTemplate, 
  CreateTransactionInput,
  CreditCard,
  FINANCIAL_STORAGE_KEYS 
} from '@/services/FinancialEngine';

// ============= NOVA ARQUITETURA DE DADOS =============

// Usar tipos do Motor Centralizado
type NovaTransacao = FinancialTransaction;
type ModeloRecorrencia = RecurringTemplate;

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
  item: ItemFinanceiroCompativel;
}

// Novas chaves de localStorage conforme especificação
const STORAGE_KEYS = {
  TRANSACTIONS: FINANCIAL_STORAGE_KEYS.TRANSACTIONS,
  RECURRING_TEMPLATES: FINANCIAL_STORAGE_KEYS.RECURRING_TEMPLATES,
  CREDIT_CARDS: FINANCIAL_STORAGE_KEYS.CREDIT_CARDS,
  ITEMS: 'lunari_fin_items'
};

// Dados iniciais padrão
const ITENS_INICIAIS: ItemFinanceiroCompativel[] = [
  // Despesas Fixas
  { id: '1', nome: 'Aluguel', grupo_principal: 'Despesa Fixa', grupoPrincipal: 'Despesa Fixa', userId: 'user1', ativo: true, criadoEm: getCurrentDateString() },
  { id: '2', nome: 'Adobe', grupo_principal: 'Despesa Fixa', grupoPrincipal: 'Despesa Fixa', userId: 'user1', ativo: true, criadoEm: getCurrentDateString() },
  { id: '3', nome: 'Internet', grupo_principal: 'Despesa Fixa', grupoPrincipal: 'Despesa Fixa', userId: 'user1', ativo: true, criadoEm: getCurrentDateString() },
  { id: '4', nome: 'Energia Elétrica', grupo_principal: 'Despesa Fixa', grupoPrincipal: 'Despesa Fixa', userId: 'user1', ativo: true, criadoEm: getCurrentDateString() },
  
  // Despesas Variáveis
  { id: '5', nome: 'Combustível', grupo_principal: 'Despesa Variável', grupoPrincipal: 'Despesa Variável', userId: 'user1', ativo: true, criadoEm: getCurrentDateString() },
  { id: '6', nome: 'Alimentação', grupo_principal: 'Despesa Variável', grupoPrincipal: 'Despesa Variável', userId: 'user1', ativo: true, criadoEm: getCurrentDateString() },
  { id: '7', nome: 'Marketing', grupo_principal: 'Despesa Variável', grupoPrincipal: 'Despesa Variável', userId: 'user1', ativo: true, criadoEm: getCurrentDateString() },
  
  // Investimentos
  { id: '8', nome: 'Acervo/Cenário', grupo_principal: 'Investimento', grupoPrincipal: 'Investimento', userId: 'user1', ativo: true, criadoEm: getCurrentDateString() },
  { id: '9', nome: 'Equipamentos', grupo_principal: 'Investimento', grupoPrincipal: 'Investimento', userId: 'user1', ativo: true, criadoEm: getCurrentDateString() },
  
  // Receitas Não Operacionais
  { id: '10', nome: 'Receita Extra', grupo_principal: 'Receita Não Operacional', grupoPrincipal: 'Receita Não Operacional', userId: 'user1', ativo: true, criadoEm: getCurrentDateString() },
  { id: '11', nome: 'Vendas de Equipamentos', grupo_principal: 'Receita Não Operacional', grupoPrincipal: 'Receita Não Operacional', userId: 'user1', ativo: true, criadoEm: getCurrentDateString() }
];

export function useNovoFinancas() {
  // ============= ESTADOS PRINCIPAIS =============
  
  const [itensFinanceiros, setItensFinanceiros] = useState<ItemFinanceiroCompativel[]>(() => {
    const saved = storage.load(STORAGE_KEYS.ITEMS, []);
    return saved.length > 0 ? saved : ITENS_INICIAIS;
  });
  
  const [transacoes, setTransacoes] = useState<NovaTransacao[]>(() => {
    return FinancialEngine.loadTransactions();
  });

  const [modelosRecorrentes, setModelosRecorrentes] = useState<ModeloRecorrencia[]>(() => {
    return FinancialEngine.loadRecurringTemplates();
  });

  const [cartoes, setCartoes] = useState<CreditCard[]>(() => {
    return FinancialEngine.loadCreditCards();
  });

  const [filtroMesAno, setFiltroMesAno] = useState(() => {
    const hoje = getCurrentDateString();
    const [ano, mes] = hoje.split('-').map(Number);
    return { mes, ano };
  });

  // ============= PERSISTÊNCIA NO LOCALSTORAGE =============
  
  useEffect(() => {
    storage.save(STORAGE_KEYS.ITEMS, itensFinanceiros);
  }, [itensFinanceiros]);

  useEffect(() => {
    // A persistência é gerenciada pelo FinancialEngine
    localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(transacoes));
  }, [transacoes]);

  useEffect(() => {
    // A persistência é gerenciada pelo FinancialEngine
    localStorage.setItem(STORAGE_KEYS.RECURRING_TEMPLATES, JSON.stringify(modelosRecorrentes));
  }, [modelosRecorrentes]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.CREDIT_CARDS, JSON.stringify(cartoes));
  }, [cartoes]);

  // ============= MOTOR DE CRIAÇÃO DE TRANSAÇÕES CENTRALIZADO =============
  
  const createTransactionEngine = (input: CreateTransactionInput) => {
    try {
      const result = FinancialEngine.createTransactions(input);
      
      // Atualizar estado local com as novas transações
      setTransacoes(prev => [...prev, ...result.transactions]);
      
      // Se houver template recorrente, adicionar também
      if (result.recurringTemplate) {
        setModelosRecorrentes(prev => [...prev, result.recurringTemplate!]);
      }
      
    } catch (error) {
      console.error('Erro ao criar transação:', error);
      throw error;
    }
  };

  // ============= FUNÇÕES AUXILIARES =============
  
  // Removidas - agora são parte do FinancialEngine

  // ============= GERAÇÃO JUST-IN-TIME PARA RECORRÊNCIAS =============
  
  useEffect(() => {
    const { mes, ano } = filtroMesAno;
    
    // Usar o motor centralizado para gerar transações recorrentes
    const novasTransacoes = FinancialEngine.generateRecurringTransactionsForMonth(
      modelosRecorrentes,
      transacoes,
      ano,
      mes
    );
    
    if (novasTransacoes.length > 0) {
      setTransacoes(prev => [...prev, ...novasTransacoes]);
    }
  }, [filtroMesAno, modelosRecorrentes]);

  // ============= PROCESSAMENTO DE DADOS PARA EXIBIÇÃO =============
  
  // Transações com informações dos itens - convertendo para formato compatível
  const transacoesComItens = useMemo((): TransacaoCompativel[] => {
    return transacoes.map(transacao => {
      const item = itensFinanceiros.find(item => item.id === transacao.itemId);
      const itemCompativel = item || { 
        id: transacao.itemId, 
        nome: 'Item Removido', 
        grupo_principal: 'Despesa Variável' as GrupoPrincipal,
        grupoPrincipal: 'Despesa Variável' as GrupoPrincipal,
        userId: 'user1',
        ativo: false,
        criadoEm: getCurrentDateString()
      };
      
      return {
        id: transacao.id,
        item_id: transacao.itemId,
        itemId: transacao.itemId,
        valor: transacao.valor,
        data_vencimento: transacao.dataVencimento,
        dataVencimento: transacao.dataVencimento,
        status: transacao.status as StatusTransacao,
        observacoes: transacao.observacoes,
        userId: 'user1',
        criadoEm: getCurrentDateString(),
        parentId: transacao.parentId,
        item: itemCompativel
      };
    });
  }, [transacoes, itensFinanceiros]);

  // Filtrar transações por mês/ano
  const transacoesFiltradas = useMemo(() => {
    return transacoesComItens.filter(transacao => {
      const [ano, mes] = transacao.dataVencimento.split('-').map(Number);
      return mes === filtroMesAno.mes && ano === filtroMesAno.ano;
    });
  }, [transacoesComItens, filtroMesAno]);

  // Agrupar transações por grupo principal
  const transacoesPorGrupo = useMemo(() => {
    const grupos: Record<GrupoPrincipal, TransacaoCompativel[]> = {
      'Despesa Fixa': [],
      'Despesa Variável': [],
      'Investimento': [],
      'Receita Não Operacional': []
    };

    transacoesFiltradas.forEach(transacao => {
      const grupo = transacao.item.grupoPrincipal;
      grupos[grupo].push(transacao);
    });

    return grupos;
  }, [transacoesFiltradas]);

  // Calcular métricas por grupo
  const calcularMetricasPorGrupo = (grupo: GrupoPrincipal) => {
    const transacoesGrupo = transacoesPorGrupo[grupo];
    const total = transacoesGrupo.reduce((sum, t) => sum + t.valor, 0);
    const pago = transacoesGrupo.filter(t => t.status === 'Pago').reduce((sum, t) => sum + t.valor, 0);
    const agendado = transacoesGrupo.filter(t => t.status === 'Agendado').reduce((sum, t) => sum + t.valor, 0);
    
    return {
      total,
      pago,
      agendado,
      quantidade: transacoesGrupo.length
    };
  };

  // Calcular resumo financeiro
  const resumoFinanceiro = useMemo(() => {
    const despesasFixas = calcularMetricasPorGrupo('Despesa Fixa');
    const despesasVariaveis = calcularMetricasPorGrupo('Despesa Variável');
    const investimentos = calcularMetricasPorGrupo('Investimento');
    const receitasExtras = calcularMetricasPorGrupo('Receita Não Operacional');

    const totalDespesas = despesasFixas.pago + despesasVariaveis.pago + investimentos.pago;
    const totalReceitasExtras = receitasExtras.pago;
    const receitaOperacional = 8500; // Virá do Workflow futuramente

    const resultadoMensal = (receitaOperacional + totalReceitasExtras) - totalDespesas;
    
    return {
      despesasFixas,
      despesasVariaveis,
      investimentos,
      receitasExtras,
      totalDespesas,
      totalReceitasExtras,
      receitaOperacional,
      resultadoMensal,
      lucroLiquido: resultadoMensal
    };
  }, [transacoesFiltradas]);

  // ============= FUNÇÕES DE GERENCIAMENTO =============
  
  // Funções para gerenciar itens financeiros
  const adicionarItemFinanceiro = (nome: string, grupoPrincipal: GrupoPrincipal) => {
    const novoItem: ItemFinanceiroCompativel = {
      id: Date.now().toString(),
      nome,
      grupo_principal: grupoPrincipal,
      grupoPrincipal,
      userId: 'user1',
      ativo: true,
      criadoEm: getCurrentDateString()
    };
    setItensFinanceiros(prev => [...prev, novoItem]);
  };

  const removerItemFinanceiro = (id: string) => {
    setItensFinanceiros(prev => prev.filter(item => item.id !== id));
    // Remove também transações e modelos relacionados
    setTransacoes(prev => prev.filter(t => t.itemId !== id));
    setModelosRecorrentes(prev => prev.filter(m => m.itemId !== id));
  };

  const atualizarItemFinanceiro = (id: string, dadosAtualizados: Partial<ItemFinanceiroCompativel>) => {
    setItensFinanceiros(prev => 
      prev.map(item => item.id === id ? { ...item, ...dadosAtualizados } : item)
    );
  };

  // Funções para gerenciar transações individuais
  const atualizarTransacao = (id: string, dadosAtualizados: Partial<NovaTransacao>) => {
    FinancialEngine.updateTransaction(id, dadosAtualizados);
    // Recarregar do localStorage para manter sincronização
    setTransacoes(FinancialEngine.loadTransactions());
  };

  const removerTransacao = (id: string) => {
    FinancialEngine.removeTransaction(id);
    // Recarregar do localStorage para manter sincronização
    setTransacoes(FinancialEngine.loadTransactions());
  };

  // Filtrar itens por grupo para dropdowns
  const obterItensPorGrupo = (grupo: GrupoPrincipal): ItemFinanceiroCompativel[] => {
    return itensFinanceiros.filter(item => item.grupoPrincipal === grupo);
  };

  // Função para compatibilidade com a API antiga
  const adicionarTransacao = (dados: any) => {
    createTransactionEngine({
      valorTotal: dados.valor,
      dataPrimeiraOcorrencia: dados.data_vencimento,
      itemId: dados.item_id,
      observacoes: dados.observacoes,
      isRecorrente: false,
      isParcelado: false
    });
  };

  // Função para atualizar transação compatível com API antiga
  const atualizarTransacaoCompativel = (id: string, dadosAtualizados: any) => {
    const dados: Partial<NovaTransacao> = {
      itemId: dadosAtualizados.item_id,
      valor: dadosAtualizados.valor,
      dataVencimento: dadosAtualizados.data_vencimento,
      observacoes: dadosAtualizados.observacoes
    };

    atualizarTransacao(id, dados);
  };

  // Funções para gerenciar cartões de crédito
  const adicionarCartao = (cartao: Omit<CreditCard, 'id'>) => {
    const novoCartao: CreditCard = {
      ...cartao,
      id: Date.now().toString()
    };
    setCartoes(prev => [...prev, novoCartao]);
  };

  const atualizarCartao = (id: string, dadosAtualizados: Partial<CreditCard>) => {
    setCartoes(prev => 
      prev.map(cartao => cartao.id === id ? { ...cartao, ...dadosAtualizados } : cartao)
    );
  };

  const removerCartao = (id: string) => {
    setCartoes(prev => prev.filter(cartao => cartao.id !== id));
  };

  // Função para limpeza completa (emergência)
  const limparTodosDados = () => {
    FinancialEngine.clearAllData();
    setTransacoes([]);
    setModelosRecorrentes([]);
    setCartoes([]);
    console.log('Todos os dados financeiros foram limpos');
  };

  return {
    // Estados principais
    itensFinanceiros,
    transacoes: transacoesFiltradas,
    filtroMesAno,
    setFiltroMesAno,
    
    // Dados processados
    transacoesPorGrupo,
    resumoFinanceiro,
    
    // Motor de criação centralizado
    createTransactionEngine,
    
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
    
    // Funções de cartões
    cartoes,
    adicionarCartao,
    atualizarCartao,
    removerCartao,
    
    // Funções utilitárias
    calcularMetricasPorGrupo,
    limparTodosDados
  };
}