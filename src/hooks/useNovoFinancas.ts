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
import { FinancialEngine, CreateTransactionInput } from '@/services/FinancialEngine';

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

// Import do novo service
import { financialItemsService, ItemFinanceiroSupabase } from '@/services/FinancialItemsService';

// Dados iniciais padrão expandidos baseados na imagem fornecida
const ITENS_INICIAIS: ItemFinanceiroCompativel[] = [
  // Despesas Fixas
  { id: 'default_1', nome: 'DAS', grupo_principal: 'Despesa Fixa', grupoPrincipal: 'Despesa Fixa', userId: 'default', ativo: true, criadoEm: getCurrentDateString() },
  { id: 'default_2', nome: 'Aluguel', grupo_principal: 'Despesa Fixa', grupoPrincipal: 'Despesa Fixa', userId: 'default', ativo: true, criadoEm: getCurrentDateString() },
  { id: 'default_3', nome: 'Água', grupo_principal: 'Despesa Fixa', grupoPrincipal: 'Despesa Fixa', userId: 'default', ativo: true, criadoEm: getCurrentDateString() },
  { id: 'default_4', nome: 'Adobe', grupo_principal: 'Despesa Fixa', grupoPrincipal: 'Despesa Fixa', userId: 'default', ativo: true, criadoEm: getCurrentDateString() },
  { id: 'default_5', nome: 'Internet', grupo_principal: 'Despesa Fixa', grupoPrincipal: 'Despesa Fixa', userId: 'default', ativo: true, criadoEm: getCurrentDateString() },
  { id: 'default_6', nome: 'Energia Elétrica', grupo_principal: 'Despesa Fixa', grupoPrincipal: 'Despesa Fixa', userId: 'default', ativo: true, criadoEm: getCurrentDateString() },
  { id: 'default_7', nome: 'Pró-labore', grupo_principal: 'Despesa Fixa', grupoPrincipal: 'Despesa Fixa', userId: 'default', ativo: true, criadoEm: getCurrentDateString() },
  { id: 'default_8', nome: 'Colaborador', grupo_principal: 'Despesa Fixa', grupoPrincipal: 'Despesa Fixa', userId: 'default', ativo: true, criadoEm: getCurrentDateString() },
  { id: 'default_9', nome: 'Assinatura', grupo_principal: 'Despesa Fixa', grupoPrincipal: 'Despesa Fixa', userId: 'default', ativo: true, criadoEm: getCurrentDateString() },
  { id: 'default_10', nome: 'Canva', grupo_principal: 'Despesa Fixa', grupoPrincipal: 'Despesa Fixa', userId: 'default', ativo: true, criadoEm: getCurrentDateString() },
  
  // Despesas Variáveis
  { id: 'default_11', nome: 'Combustível', grupo_principal: 'Despesa Variável', grupoPrincipal: 'Despesa Variável', userId: 'default', ativo: true, criadoEm: getCurrentDateString() },
  { id: 'default_12', nome: 'Alimentação', grupo_principal: 'Despesa Variável', grupoPrincipal: 'Despesa Variável', userId: 'default', ativo: true, criadoEm: getCurrentDateString() },
  { id: 'default_13', nome: 'Marketing', grupo_principal: 'Despesa Variável', grupoPrincipal: 'Despesa Variável', userId: 'default', ativo: true, criadoEm: getCurrentDateString() },
  { id: 'default_14', nome: 'Fornecedor 1', grupo_principal: 'Despesa Variável', grupoPrincipal: 'Despesa Variável', userId: 'default', ativo: true, criadoEm: getCurrentDateString() },
  { id: 'default_15', nome: 'Fornecedor 2', grupo_principal: 'Despesa Variável', grupoPrincipal: 'Despesa Variável', userId: 'default', ativo: true, criadoEm: getCurrentDateString() },
  { id: 'default_16', nome: 'Cursos e treinamentos', grupo_principal: 'Despesa Variável', grupoPrincipal: 'Despesa Variável', userId: 'default', ativo: true, criadoEm: getCurrentDateString() },
  
  // Investimentos
  { id: 'default_17', nome: 'Acervo/Cenário', grupo_principal: 'Investimento', grupoPrincipal: 'Investimento', userId: 'default', ativo: true, criadoEm: getCurrentDateString() },
  { id: 'default_18', nome: 'Equipamentos', grupo_principal: 'Investimento', grupoPrincipal: 'Investimento', userId: 'default', ativo: true, criadoEm: getCurrentDateString() },
  
  // Receitas Não Operacionais
  { id: 'default_19', nome: 'Receita Extra', grupo_principal: 'Receita Não Operacional', grupoPrincipal: 'Receita Não Operacional', userId: 'default', ativo: true, criadoEm: getCurrentDateString() },
  { id: 'default_20', nome: 'Vendas de Equipamentos', grupo_principal: 'Receita Não Operacional', grupoPrincipal: 'Receita Não Operacional', userId: 'default', ativo: true, criadoEm: getCurrentDateString() }
];

export function useNovoFinancas() {
  // ============= INTEGRAÇÃO COM CARTÕES =============
  const { cartoes, adicionarCartao, atualizarCartao, removerCartao } = useAppContext();
  
  // ============= ESTADOS PRINCIPAIS =============
  
  const [itensFinanceiros, setItensFinanceiros] = useState<ItemFinanceiroCompativel[]>(() => {
    const saved = storage.load(STORAGE_KEYS.ITEMS, []);
    return saved.length > 0 ? saved : ITENS_INICIAIS;
  });

  // Service methods for financial items
  const adicionarItemFinanceiro = async (nome: string, grupo: GrupoPrincipal) => {
    try {
      const novoItem = await financialItemsService.createItem({
        nome,
        grupo_principal: grupo,
        userId: 'user1',
        ativo: true
      });
      
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
      const itemAtualizado = await financialItemsService.updateItem(id, updates);
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
      await financialItemsService.deleteItem(id);
      setItensFinanceiros(prev => prev.filter(item => item.id !== id));
    } catch (error) {
      console.error('Erro ao remover item financeiro:', error);
      throw error;
    }
  };
  
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
        
        // Force scan para equipamentos (transações recorrentes)
        setTimeout(() => {
          const forceScanEvent = new CustomEvent('equipment-sync:force-scan');
          window.dispatchEvent(forceScanEvent);
          console.log('🔧 [EquipmentSync] Force scan disparado após criação de transações recorrentes');
        }, 500);
      
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
  
  const createTransactionEngine = (input: CreateTransactionInput) => {
    console.log('createTransactionEngine chamado com dados:', input);
    
    try {
      const { valorTotal, dataPrimeiraOcorrencia, itemId, isRecorrente, isParcelado, numeroDeParcelas, observacoes, isValorFixo, cartaoCreditoId } = input;
      
      console.log('Processando CreateTransactionInput:', {
        valorTotal,
        dataPrimeiraOcorrencia,
        itemId,
        isRecorrente,
        isParcelado,
        numeroDeParcelas,
        observacoes,
        isValorFixo,
        cartaoCreditoId
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
      
      // 2. TRANSAÇÕES PARCELADAS (CARTÃO DE CRÉDITO) - USAR FINANCIALENGINE
      if (isParcelado && numeroDeParcelas && numeroDeParcelas > 1 && cartaoCreditoId) {
        console.log('Criando transações parceladas no cartão de crédito');
        
        const resultado = FinancialEngine.createTransactions(input);
        
        // Converter transações do FinancialEngine para formato do Blueprint
        const transacoesConvertidas: NovaTransacao[] = resultado.transactions.map(transacao => ({
          id: transacao.id,
          itemId: transacao.itemId,
          valor: transacao.valor,
          dataVencimento: transacao.dataVencimento,
          status: transacao.status as StatusTransacao,
          observacoes: transacao.observacoes,
          userId: 'user1',
          criadoEm: getCurrentDateString()
        }));
        
        setTransacoes(prev => [...prev, ...transacoesConvertidas]);
        console.log(`${transacoesConvertidas.length} transações parceladas criadas com sucesso`);
        
        // Force scan para equipamentos (transações parceladas)
        setTimeout(() => {
          const forceScanEvent = new CustomEvent('equipment-sync:force-scan');
          window.dispatchEvent(forceScanEvent);
          console.log('🔧 [EquipmentSync] Force scan disparado após criação de transações parceladas');
        }, 500);
        
        return;
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

      // ============= FORCE SCAN PARA EQUIPAMENTOS =============
      // Disparar force-scan após transação para detectar equipamentos
      setTimeout(() => {
        const forceScanEvent = new CustomEvent('equipment-sync:force-scan');
        window.dispatchEvent(forceScanEvent);
        console.log('🔧 [EquipmentSync] Force scan disparado após criação de transação');
      }, 500); // Delay aumentado para garantir persistência
      
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
      const itemCompativel = item ? {
        ...item,
        grupoPrincipal: item.grupo_principal
      } : { 
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
  // Funções de gerenciamento de itens já declaradas acima no useState

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
    // Buscar transação existente para preservar campos não editados
    const transacaoExistente = transacoes.find(t => t.id === id);
    if (!transacaoExistente) {
      console.error('ERRO: Transação não encontrada para ID:', id);
      return;
    }

    // Converter formato antigo para novo formato preservando campos críticos
    const dados: Partial<NovaTransacao> = {
      itemId: dadosAtualizados.item_id || transacaoExistente.itemId, // ✅ PRESERVAR se não fornecido
      valor: dadosAtualizados.valor,
      dataVencimento: dadosAtualizados.data_vencimento,
      observacoes: dadosAtualizados.observacoes,
      status: dadosAtualizados.status || 'Agendado'
    };

    // Validação de integridade crítica
    if (!dados.itemId) {
      console.error('ERRO CRÍTICO: Tentativa de atualizar transação sem itemId', { 
        id, 
        dadosAtualizados, 
        transacaoExistente: transacaoExistente 
      });
      return;
    }

    console.log('Atualizando transação:', { id, dados });
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