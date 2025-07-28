import { useState, useMemo, useEffect } from 'react';
import { ItemFinanceiro, GrupoPrincipal, StatusTransacao } from '@/types/financas';
import { storage } from '@/utils/localStorage';
import { getCurrentDateString } from '@/utils/dateUtils';
import { useAppContext } from '@/contexts/AppContext';
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
  // ============= INTEGRAÇÃO COM CARTÕES =============
  const { cartoes, adicionarCartao, atualizarCartao, removerCartao } = useAppContext();
  
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

  // ============= MOTOR DE CRIAÇÃO DE TRANSAÇÕES RECORRENTES =============
  
  const createRecurringTransactionsEngine = (input: CreateBlueprintInput) => {
    try {
      console.log('Criando transações recorrentes anuais:', input);
      
      // Nova abordagem: criar todas as transações do ano
      const novasTransacoes = RecurringBlueprintEngine.createYearlyRecurringTransactions(input);
      
      // Atualizar estado local apenas com as novas transações
      setTransacoes(prev => [...prev, ...novasTransacoes]);
      
      console.log(`${novasTransacoes.length} transações recorrentes criadas com sucesso`);
      
    } catch (error) {
      console.error('Erro ao criar transações recorrentes:', error);
      throw error;
    }
  };

  // DEPRECATED: Manter para compatibilidade com código antigo
  const createBlueprintEngine = (input: CreateBlueprintInput) => {
    console.warn('createBlueprintEngine está depreciado. Use createRecurringTransactionsEngine');
    return createRecurringTransactionsEngine(input);
  };
  
  const createTransactionEngine = (input: any) => {
    console.log('createTransactionEngine chamado com dados:', input);
    
    try {
      // Verificar se input é do tipo CreateTransactionInput
      const isCreateTransactionInput = input.valorTotal !== undefined && input.dataPrimeiraOcorrencia !== undefined;
      
      if (isCreateTransactionInput) {
        // Processar CreateTransactionInput
        const { valorTotal, dataPrimeiraOcorrencia, itemId, isRecorrente, isParcelado, numeroDeParcelas, observacoes, isValorFixo } = input;
        
        console.log('Processando CreateTransactionInput:', {
          valorTotal,
          dataPrimeiraOcorrencia,
          itemId,
          isRecorrente,
          isParcelado,
          numeroDeParcelas,
          observacoes,
          isValorFixo
        });
        
        // 1. TRANSAÇÕES RECORRENTES (NOVA ABORDAGEM)
        if (isRecorrente) {
          console.log('Criando transações recorrentes anuais');
          return createRecurringTransactionsEngine({
            itemId,
            valor: valorTotal,
            isValorFixo: isValorFixo ?? true,
            dataPrimeiraOcorrencia,
            observacoes
          });
        }
        
        // 2. TRANSAÇÕES PARCELADAS (CARTÃO DE CRÉDITO)
        if (isParcelado && numeroDeParcelas && numeroDeParcelas > 1) {
          const cartaoId = input.cartaoCreditoId;
          if (cartaoId) {
            const cartao = cartoes.find(c => c.id === cartaoId);
            if (cartao) {
              console.log(`Criando ${numeroDeParcelas} parcelas no cartão ${cartao.nome}`);
              const transacoesParcelas: NovaTransacao[] = [];
              const valorParcela = valorTotal / numeroDeParcelas;
              
              for (let i = 0; i < numeroDeParcelas; i++) {
                const dataCompra = new Date(dataPrimeiraOcorrencia);
                const dataVencimento = new Date(dataCompra);
                dataVencimento.setMonth(dataVencimento.getMonth() + i);
                dataVencimento.setDate(cartao.diaVencimento);
                
                const transacaoParcela: NovaTransacao = {
                  id: `credit_${Date.now()}_${i + 1}`,
                  itemId,
                  valor: valorParcela,
                  dataVencimento: dataVencimento.toISOString().split('T')[0],
                  status: dataVencimento.toISOString().split('T')[0] <= getCurrentDateString() ? 'Faturado' : 'Agendado',
                  observacoes: `${observacoes || ''} ${cartao.nome} ${i + 1}/${numeroDeParcelas}`.trim(),
                  parcelaInfo: { atual: i + 1, total: numeroDeParcelas },
                  userId: 'user1',
                  criadoEm: getCurrentDateString()
                };
                
                transacoesParcelas.push(transacaoParcela);
              }
              
              setTransacoes(prev => [...prev, ...transacoesParcelas]);
              console.log(`${numeroDeParcelas} parcelas criadas no cartão ${cartao.nome}`);
              return;
            }
          }
        }
        
        // 3. TRANSAÇÃO ÚNICA
        console.log('Criando transação única');
        const novaTransacao: NovaTransacao = {
          id: `single_${Date.now()}`,
          itemId,
          valor: valorTotal,
          dataVencimento: dataPrimeiraOcorrencia,
          status: dataPrimeiraOcorrencia <= getCurrentDateString() ? 'Faturado' : 'Agendado',
          observacoes,
          userId: 'user1',
          criadoEm: getCurrentDateString()
        };
        
        setTransacoes(prev => [...prev, novaTransacao]);
        console.log('Transação única criada com sucesso:', novaTransacao);
        return;
      }
      
      // Fallback para formato antigo (compatibilidade)
      console.log('Processando formato antigo de dados');
      const novaTransacao: NovaTransacao = {
        id: `single_${Date.now()}`,
        itemId: input.item_id || input.itemId,
        valor: input.valor || input.valorTotal,
        dataVencimento: input.data_vencimento || input.dataPrimeiraOcorrencia,
        status: (input.data_vencimento || input.dataPrimeiraOcorrencia) <= getCurrentDateString() ? 'Faturado' : 'Agendado',
        observacoes: input.observacoes,
        userId: 'user1',
        criadoEm: getCurrentDateString()
      };
      
      setTransacoes(prev => [...prev, novaTransacao]);
      console.log('Transação (formato antigo) criada com sucesso:', novaTransacao);
      
    } catch (error) {
      console.error('Erro ao criar transação:', error);
      throw error;
    }
  };

  // ============= FUNÇÕES AUXILIARES =============
  
  // Removidas - agora são parte do FinancialEngine

  // ============= ATUALIZAÇÃO AUTOMÁTICA DE STATUS =============
  
  useEffect(() => {
    // Apenas atualizar status automaticamente quando filtro muda
    // Geração just-in-time foi removida para evitar duplicações
    setTimeout(() => atualizarStatusAutomatico(), 100);
  }, [filtroMesAno]);
  
  // Verificar status automaticamente a cada minuto
  useEffect(() => {
    const interval = setInterval(() => {
      atualizarStatusAutomatico();
    }, 60000); // 1 minuto
    
    return () => clearInterval(interval);
  }, []);
  
  // ============= MIGRAÇÃO PARA NOVA ARQUITETURA (EXECUTADO UMA VEZ) =============
  
  useEffect(() => {
    const migracaoNovaArquitetura = localStorage.getItem('recurring_to_individual_migration_completed');
    
    if (!migracaoNovaArquitetura) {
      console.log('Executando migração para nova arquitetura de transações individuais...');
      
      try {
        // 1. Migrar blueprints existentes para transações individuais
        const blueprints = RecurringBlueprintEngine.loadBlueprints();
        const transacoesExistentes = RecurringBlueprintEngine.loadTransactions();
        
        blueprints.forEach(blueprint => {
          console.log(`Migrando blueprint ${blueprint.id} para transações individuais`);
          
          // Criar transações para os meses restantes do ano
          const [anoAtual] = getCurrentDateString().split('-').map(Number);
          
          for (let mes = 1; mes <= 12; mes++) {
            const dataVencimento = RecurringBlueprintEngine['calculateDateForMonth'](blueprint, anoAtual, mes);
            
            // Verificar se já existe transação para este mês
            const jaExiste = transacoesExistentes.some(t => 
              t.itemId === blueprint.itemId && t.dataVencimento === dataVencimento
            );
            
            if (!jaExiste) {
              const novaTransacao: NovaTransacao = {
                id: `migrated_${blueprint.id}_${mes}_${Math.random().toString(36).substr(2, 9)}`,
                itemId: blueprint.itemId,
                valor: blueprint.valor || 0,
                dataVencimento,
                status: RecurringBlueprintEngine['determineStatus'](dataVencimento) as any,
                observacoes: blueprint.observacoes || (blueprint.isValorFixo ? 'Valor Fixo' : 'Valor Variável'),
                userId: 'user1',
                criadoEm: getCurrentDateString()
              };
              
              RecurringBlueprintEngine.saveTransaction(novaTransacao as any);
            }
          }
        });
        
        // 2. Limpar duplicações existentes
        RecurringBlueprintEngine.cleanDuplicatedTransactions();
        
        // 3. Remover blueprints antigos (não são mais necessários)
        localStorage.removeItem(BLUEPRINT_STORAGE_KEYS.BLUEPRINTS);
        
        // 4. Marcar migração como concluída
        localStorage.setItem('recurring_to_individual_migration_completed', 'true');
        
        // 5. Recarregar dados após migração
        setTransacoes(RecurringBlueprintEngine.loadTransactions());
        setBlueprintsRecorrentes([]); // Não usar mais blueprints
        
        console.log('Migração para nova arquitetura concluída com sucesso');
        
      } catch (error) {
        console.error('Erro durante migração:', error);
        // Em caso de erro, apenas marcar como concluída para não tentar novamente
        localStorage.setItem('recurring_to_individual_migration_completed', 'true');
      }
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

  // Função para atualizar status automaticamente
  const atualizarStatusAutomatico = () => {
    const hoje = getCurrentDateString();
    const transacoesParaAtualizar = transacoes.filter(transacao => 
      transacao.status === 'Agendado' && transacao.dataVencimento <= hoje
    );
    
    if (transacoesParaAtualizar.length > 0) {
      console.log(`Atualizando ${transacoesParaAtualizar.length} transações para Faturado`);
      transacoesParaAtualizar.forEach(transacao => {
        RecurringBlueprintEngine.updateTransaction(transacao.id, { status: 'Faturado' });
      });
      // Recarregar do localStorage para manter sincronização
      setTransacoes(RecurringBlueprintEngine.loadTransactions());
    }
  };

  // Calcular métricas por grupo (agora inclui "Faturado")
  const calcularMetricasPorGrupo = (grupo: GrupoPrincipal) => {
    const transacoesGrupo = transacoesPorGrupo[grupo];
    const total = transacoesGrupo.reduce((sum, t) => sum + t.valor, 0);
    const pago = transacoesGrupo.filter(t => t.status === 'Pago').reduce((sum, t) => sum + t.valor, 0);
    const faturado = transacoesGrupo.filter(t => t.status === 'Faturado').reduce((sum, t) => sum + t.valor, 0);
    const agendado = transacoesGrupo.filter(t => t.status === 'Agendado').reduce((sum, t) => sum + t.valor, 0);
    
    return {
      total,
      pago,
      faturado,
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
    const totalDespesasFaturadas = despesasFixas.faturado + despesasVariaveis.faturado + investimentos.faturado;
    const totalReceitasExtras = receitasExtras.pago;
    const receitaOperacional = 8500; // Virá do Workflow futuramente

    const resultadoMensal = (receitaOperacional + totalReceitasExtras) - totalDespesas;
    
    return {
      despesasFixas,
      despesasVariaveis,
      investimentos,
      receitasExtras,
      totalDespesas,
      totalDespesasFaturadas,
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
      // Criar transações recorrentes anuais (nova abordagem)
      createRecurringTransactionsEngine({
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
      observacoes: dadosAtualizados.observacoes,
      status: dadosAtualizados.status // CORRIGIDO: incluir status na atualização
    };

    console.log('Atualizando transação:', id, dados);
    atualizarTransacao(id, dados);
  };

  // Marcar transação como paga
  const marcarComoPago = (id: string) => {
    atualizarTransacao(id, { status: 'Pago' });
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
    createRecurringTransactionsEngine,
    
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
    marcarComoPago,
    
    // Funções de blueprints
    removerBlueprint,
    
    // Gestão de cartões (integração com AppContext)
    cartoes,
    adicionarCartao,
    atualizarCartao,
    removerCartao,
    
    // Funções utilitárias
    calcularMetricasPorGrupo,
    limparTodosDados
  };
}