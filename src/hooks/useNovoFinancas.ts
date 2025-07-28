import { useState, useMemo, useEffect } from 'react';
import { ItemFinanceiro, GrupoPrincipal, StatusTransacao } from '@/types/financas';
import { storage } from '@/utils/localStorage';
import { getCurrentDateString } from '@/utils/dateUtils';
import { 
  RecurringBlueprintEngine, 
  RecurringBlueprint, 
  BlueprintTransaction,
  CreateBlueprintInput,
  BLUEPRINT_STORAGE_KEYS 
} from '@/services/RecurringBlueprintEngine';

// ============= NOVA ARQUITETURA DE BLUEPRINTS =============

// Usar tipos do Motor de Blueprints
type NovaTransacao = BlueprintTransaction;
type ModeloRecorrencia = RecurringBlueprint;

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

// Novas chaves de localStorage conforme nova arquitetura
const STORAGE_KEYS = {
  TRANSACTIONS: BLUEPRINT_STORAGE_KEYS.TRANSACTIONS,
  BLUEPRINTS: BLUEPRINT_STORAGE_KEYS.BLUEPRINTS,
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
    return RecurringBlueprintEngine.loadTransactions();
  });

  const [blueprintsRecorrentes, setBlueprintsRecorrentes] = useState<ModeloRecorrencia[]>(() => {
    return RecurringBlueprintEngine.loadBlueprints();
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
    // A persistência é gerenciada pelo RecurringBlueprintEngine
    localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(transacoes));
  }, [transacoes]);

  useEffect(() => {
    // A persistência é gerenciada pelo RecurringBlueprintEngine
    localStorage.setItem(STORAGE_KEYS.BLUEPRINTS, JSON.stringify(blueprintsRecorrentes));
  }, [blueprintsRecorrentes]);

  // ============= MOTOR DE CRIAÇÃO DE BLUEPRINTS =============
  
  const createBlueprintEngine = (input: CreateBlueprintInput) => {
    try {
      const result = RecurringBlueprintEngine.createBlueprint(input);
      
      // Atualizar estado local com o novo blueprint e primeira transação
      setBlueprintsRecorrentes(prev => [...prev, result.blueprint]);
      setTransacoes(prev => [...prev, result.firstTransaction]);
      
    } catch (error) {
      console.error('Erro ao criar blueprint:', error);
      throw error;
    }
  };
  
  const createTransactionEngine = (dados: any) => {
    // Para transações únicas (não recorrentes)
    const novaTransacao: NovaTransacao = {
      id: `single_${Date.now()}`,
      itemId: dados.item_id,
      valor: dados.valor,
      dataVencimento: dados.data_vencimento,
      status: dados.data_vencimento <= getCurrentDateString() ? 'Faturado' : 'Agendado',
      observacoes: dados.observacoes,
      userId: 'user1',
      criadoEm: getCurrentDateString()
    };
    
    setTransacoes(prev => [...prev, novaTransacao]);
  };

  // ============= FUNÇÕES AUXILIARES =============
  
  // Removidas - agora são parte do FinancialEngine

  // ============= GERAÇÃO JUST-IN-TIME PARA BLUEPRINTS =============
  
  useEffect(() => {
    const { mes, ano } = filtroMesAno;
    
    // NOVA ARQUITETURA: Usar o motor de blueprints para geração just-in-time
    const novasTransacoes = RecurringBlueprintEngine.generateTransactionsForMonth(ano, mes);
    
    if (novasTransacoes.length > 0) {
      setTransacoes(prev => [...prev, ...novasTransacoes]);
    }
  }, [filtroMesAno]);
  
  // ============= MIGRAÇÃO E LIMPEZA DE DADOS (EXECUTADO UMA VEZ) =============
  
  useEffect(() => {
    const migracaoExecutada = localStorage.getItem('blueprint_migration_completed');
    
    if (!migracaoExecutada) {
      console.log('Executando migração e limpeza de dados...');
      
      // 1. Migrar dados antigos para blueprints
      RecurringBlueprintEngine.migrateOldRecurringTransactions();
      
      // 2. Limpar duplicações existentes
      RecurringBlueprintEngine.cleanDuplicatedTransactions();
      
      // 3. Marcar migração como concluída
      localStorage.setItem('blueprint_migration_completed', 'true');
      
      // 4. Recarregar dados após migração
      setBlueprintsRecorrentes(RecurringBlueprintEngine.loadBlueprints());
      setTransacoes(RecurringBlueprintEngine.loadTransactions());
      
      console.log('Migração concluída com sucesso');
    }
  }, []);

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
        userId: transacao.userId,
        criadoEm: transacao.criadoEm,
        parentId: transacao.blueprintId, // blueprintId mapeado para parentId para compatibilidade
        item: itemCompativel
      };
    });
  }, [transacoes, itensFinanceiros]);

  // Filtrar transações por mês/ano
  const transacoesFiltradas = useMemo(() => {
    return transacoesComItens.filter(transacao => {
      // Verificação de segurança para dataVencimento
      if (!transacao.dataVencimento || typeof transacao.dataVencimento !== 'string') {
        console.warn('Transação com dataVencimento inválida:', transacao);
        return false;
      }
      
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
    // Remove também transações e blueprints relacionados
    setTransacoes(prev => prev.filter(t => t.itemId !== id));
    setBlueprintsRecorrentes(prev => prev.filter(b => b.itemId !== id));
  };

  const atualizarItemFinanceiro = (id: string, dadosAtualizados: Partial<ItemFinanceiroCompativel>) => {
    setItensFinanceiros(prev => 
      prev.map(item => item.id === id ? { ...item, ...dadosAtualizados } : item)
    );
  };

  // Funções para gerenciar transações individuais
  const atualizarTransacao = (id: string, dadosAtualizados: Partial<NovaTransacao>) => {
    RecurringBlueprintEngine.updateTransaction(id, dadosAtualizados);
    // Recarregar do localStorage para manter sincronização
    setTransacoes(RecurringBlueprintEngine.loadTransactions());
  };

  const removerTransacao = (id: string) => {
    RecurringBlueprintEngine.removeTransaction(id);
    // Recarregar do localStorage para manter sincronização
    setTransacoes(RecurringBlueprintEngine.loadTransactions());
  };

  // Filtrar itens por grupo para dropdowns
  const obterItensPorGrupo = (grupo: GrupoPrincipal): ItemFinanceiroCompativel[] => {
    return itensFinanceiros.filter(item => item.grupoPrincipal === grupo);
  };

  // Função para compatibilidade com a API antiga
  const adicionarTransacao = (dados: any) => {
    if (dados.isRecorrente) {
      // Criar blueprint
      createBlueprintEngine({
        itemId: dados.item_id,
        valor: dados.valor,
        isValorFixo: dados.isValorFixo ?? true,
        dataPrimeiraOcorrencia: dados.data_vencimento,
        observacoes: dados.observacoes
      });
    } else {
      // Criar transação única
      createTransactionEngine(dados);
    }
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

  // Funções para gerenciar blueprints
  const removerBlueprint = (id: string) => {
    RecurringBlueprintEngine.removeBlueprint(id);
    setBlueprintsRecorrentes(RecurringBlueprintEngine.loadBlueprints());
    setTransacoes(RecurringBlueprintEngine.loadTransactions());
  };

  // Função para limpeza completa (emergência)
  const limparTodosDados = () => {
    RecurringBlueprintEngine.clearAllData();
    setTransacoes([]);
    setBlueprintsRecorrentes([]);
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
    createBlueprintEngine,
    
    // Dados de blueprints
    blueprintsRecorrentes,
    
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
    
    // Funções de blueprints
    removerBlueprint,
    
    // Placeholders para compatibilidade (cartões não implementados na nova arquitetura)
    cartoes: [] as any[],
    adicionarCartao: () => console.warn('Cartões não implementados na nova arquitetura'),
    atualizarCartao: () => console.warn('Cartões não implementados na nova arquitetura'),
    removerCartao: () => console.warn('Cartões não implementados na nova arquitetura'),
    
    // Funções utilitárias
    calcularMetricasPorGrupo,
    limparTodosDados
  };
}