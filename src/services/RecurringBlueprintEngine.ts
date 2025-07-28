/**
 * MOTOR DE BLUEPRINTS PARA LANÇAMENTOS RECORRENTES
 * 
 * Esta é a implementação final e definitiva da nova arquitetura de Blueprints.
 * Substitui completamente o sistema anterior de "pai-filho" que causava duplicações.
 * 
 * PRINCÍPIOS FUNDAMENTAIS:
 * 1. Blueprints são "regras" - Transações são "instâncias"
 * 2. Geração Just-in-Time: só cria quando necessário
 * 3. Edição isolada: modificar instância não afeta blueprint
 * 4. Zero duplicação: verificação de existência obrigatória
 */

import { getCurrentDateString } from '@/utils/dateUtils';

// ============= ESTRUTURAS DE DADOS =============

export interface RecurringBlueprint {
  id: string;
  itemId: string;
  valor: number; // 0 se valor variável
  isValorFixo: boolean;
  diaVencimento: number; // 1-31
  dataInicio: string; // YYYY-MM-DD
  dataFim: string; // YYYY-MM-DD
  observacoes?: string;
  userId: string;
  criadoEm: string;
}

export interface BlueprintTransaction {
  id: string;
  itemId: string;
  valor: number;
  dataVencimento: string; // YYYY-MM-DD
  status: 'Agendado' | 'Faturado' | 'Pago';
  observacoes?: string;
  blueprintId?: string; // ID do blueprint que gerou esta transação
  parcelaInfo?: { atual: number; total: number } | null;
  userId: string;
  criadoEm: string;
}

export interface CreateBlueprintInput {
  itemId: string;
  valor: number;
  isValorFixo: boolean;
  dataPrimeiraOcorrencia: string;
  observacoes?: string;
}

// ============= CHAVES DE STORAGE =============

export const BLUEPRINT_STORAGE_KEYS = {
  BLUEPRINTS: 'lunari_fin_recurring_blueprints',
  TRANSACTIONS: 'lunari_fin_transactions',
  EXCLUDED_TRANSACTIONS: 'lunari_fin_excluded_transactions'
} as const;

// ============= MOTOR PRINCIPAL =============

export class RecurringBlueprintEngine {
  
  /**
   * CRIAR TRANSAÇÕES RECORRENTES ANUAIS (NOVA ABORDAGEM)
   * Em vez de blueprint + geração dinâmica, cria 12 transações únicas para o ano
   * Cada transação é independente e pode ser editada/excluída sem afetar outras
   */
  static createYearlyRecurringTransactions(input: CreateBlueprintInput): BlueprintTransaction[] {
    const { itemId, valor, isValorFixo, dataPrimeiraOcorrencia, observacoes } = input;
    
    // Validações
    if (!itemId || valor <= 0) {
      throw new Error('ItemId e valor são obrigatórios');
    }
    
    const [ano, mes, dia] = dataPrimeiraOcorrencia.split('-').map(Number);
    const transacoes: BlueprintTransaction[] = [];
    
    console.log(`Criando transações recorrentes para ${itemId} a partir de ${mes}/${ano}`);
    
    // Gerar transação para cada mês do ano, começando do mês especificado
    for (let mesAtual = mes; mesAtual <= 12; mesAtual++) {
      // Calcular último dia do mês para ajustar se necessário
      const ultimoDiaMes = new Date(Date.UTC(ano, mesAtual, 0)).getUTCDate();
      const diaVencimento = Math.min(dia, ultimoDiaMes);
      
      const dataVencimento = `${ano}-${mesAtual.toString().padStart(2, '0')}-${diaVencimento.toString().padStart(2, '0')}`;
      
      const transacao: BlueprintTransaction = {
        id: `recurring_${Date.now()}_${mesAtual}_${Math.random().toString(36).substr(2, 9)}`,
        itemId,
        valor: isValorFixo ? valor : valor, // Para valor variável, usar valor inicial digitado
        dataVencimento,
        status: this.determineStatus(dataVencimento),
        observacoes: isValorFixo 
          ? (observacoes ? `${observacoes} (Valor Fixo)` : 'Valor Fixo')
          : (observacoes ? `${observacoes} (Valor Variável)` : 'Valor Variável'),
        userId: 'user1',
        criadoEm: getCurrentDateString()
        // SEM blueprintId - cada transação é independente
      };
      
      transacoes.push(transacao);
    }
    
    // Salvar todas as transações no localStorage
    transacoes.forEach(transacao => this.saveTransaction(transacao));
    
    console.log(`${transacoes.length} transações criadas para o ano ${ano}`);
    return transacoes;
  }

  /**
   * CRIAR NOVO BLUEPRINT E PRIMEIRA INSTÂNCIA (MANTIDO PARA COMPATIBILIDADE)
   * DEPRECATED: Use createYearlyRecurringTransactions() para novas implementações
   */
  static createBlueprint(input: CreateBlueprintInput): {
    blueprint: RecurringBlueprint;
    firstTransaction: BlueprintTransaction;
  } {
    console.warn('createBlueprint() está depreciado. Use createYearlyRecurringTransactions()');
    
    const { itemId, valor, isValorFixo, dataPrimeiraOcorrencia, observacoes } = input;
    
    // Validações
    if (!itemId || valor <= 0) {
      throw new Error('ItemId e valor são obrigatórios');
    }
    
    const [ano, mes, dia] = dataPrimeiraOcorrencia.split('-').map(Number);
    
    // Criar blueprint (regra)
    const blueprint: RecurringBlueprint = {
      id: `blueprint_${Date.now()}`,
      itemId,
      valor: isValorFixo ? valor : 0, // Se valor variável, salvar 0 no blueprint
      isValorFixo,
      diaVencimento: dia,
      dataInicio: dataPrimeiraOcorrencia,
      dataFim: `${ano}-12-31`, // Último dia do ano corrente
      observacoes,
      userId: 'user1',
      criadoEm: getCurrentDateString()
    };
    
    // Criar primeira instância sempre com valor digitado pelo usuário
    const firstTransaction: BlueprintTransaction = {
      id: `${blueprint.id}_primeira`,
      itemId,
      valor: valor, // SEMPRE usar valor digitado pelo usuário
      dataVencimento: dataPrimeiraOcorrencia,
      status: this.determineStatus(dataPrimeiraOcorrencia),
      blueprintId: blueprint.id,
      observacoes: isValorFixo 
        ? (observacoes ? `${observacoes} (Valor Fixo)` : 'Valor Fixo')
        : (observacoes ? `${observacoes} (Editar Valor)` : 'Editar Valor'),
      userId: 'user1',
      criadoEm: getCurrentDateString()
    };
    
    // Salvar no localStorage
    this.saveBlueprint(blueprint);
    this.saveTransaction(firstTransaction);
    
    return { blueprint, firstTransaction };
  }
  
  /**
   * GERAÇÃO JUST-IN-TIME À PROVA DE DUPLICAÇÃO
   * Esta função deve ser chamada ao exibir um mês específico
   */
  static generateTransactionsForMonth(year: number, month: number): BlueprintTransaction[] {
    const blueprints = this.loadBlueprints();
    const existingTransactions = this.loadTransactions();
    const newTransactions: BlueprintTransaction[] = [];
    
    console.log(`Gerando transações para ${month}/${year}...`);
    
    blueprints.forEach(blueprint => {
      // 1. Verificar se blueprint está ativo para este mês
      if (!this.isBlueprintActiveForMonth(blueprint, year, month)) {
        return;
      }
      
      // 2. Calcular data esperada para este mês
      const expectedDate = this.calculateDateForMonth(blueprint, year, month);
      
      // 3. VERIFICAÇÃO CRÍTICA: Já existe transação para este blueprint+mês?
      const existingTransaction = existingTransactions.find(t => 
        t.blueprintId === blueprint.id && t.dataVencimento === expectedDate
      );
      
      // 4. VERIFICAÇÃO DE EXCLUSÃO INTENCIONAL
      const isIntentionallyExcluded = this.isTransactionExcluded(blueprint.id, expectedDate);
      
      // 5. Se NÃO existe E NÃO foi excluída intencionalmente, criar nova instância
      if (!existingTransaction && !isIntentionallyExcluded) {
        const newTransaction: BlueprintTransaction = {
          id: `${blueprint.id}_${year}_${month}`,
          itemId: blueprint.itemId,
          valor: blueprint.isValorFixo ? blueprint.valor : 0, // Valor variável inicia com 0
          dataVencimento: expectedDate,
          status: this.determineStatus(expectedDate),
          blueprintId: blueprint.id,
          observacoes: blueprint.isValorFixo 
            ? (blueprint.observacoes ? `${blueprint.observacoes} (Valor Fixo)` : 'Valor Fixo')
            : (blueprint.observacoes ? `${blueprint.observacoes} (Editar Valor)` : 'Editar Valor'),
          userId: 'user1',
          criadoEm: getCurrentDateString()
        };
        
        newTransactions.push(newTransaction);
        console.log(`Nova transação criada: ${blueprint.itemId} para ${expectedDate}`);
      } else if (existingTransaction) {
        console.log(`Transação já existe: ${blueprint.itemId} para ${expectedDate}`);
      } else if (isIntentionallyExcluded) {
        console.log(`Transação excluída intencionalmente: ${blueprint.itemId} para ${expectedDate}`);
      }
    });
    
    // Salvar novas transações se houver
    if (newTransactions.length > 0) {
      newTransactions.forEach(transaction => this.saveTransaction(transaction));
      console.log(`${newTransactions.length} novas transações criadas para ${month}/${year}`);
    }
    
    return newTransactions;
  }
  
  /**
   * MIGRAÇÃO DE DADOS EXISTENTES
   * Converte o sistema antigo para blueprints
   */
  static migrateOldRecurringTransactions(): void {
    console.log('Iniciando migração de dados antigos...');
    
    // Carregar transações antigas
    const oldTransactions = JSON.parse(localStorage.getItem('lunari_transactions') || '[]');
    const existingBlueprints = this.loadBlueprints();
    
    // Filtrar apenas as recorrentes que não foram migradas
    const recurringTransactions = oldTransactions.filter((t: any) => 
      t.isRecorrente === true && 
      !existingBlueprints.some(b => b.itemId === t.categoriaId && b.diaVencimento === new Date(t.data).getDate())
    );
    
    console.log(`Encontradas ${recurringTransactions.length} transações recorrentes para migrar`);
    
    // Agrupar por categoriaId + dia do vencimento (identificar blueprints únicos)
    const blueprintGroups = new Map<string, any[]>();
    
    recurringTransactions.forEach((transaction: any) => {
      const dia = new Date(transaction.data).getDate();
      const key = `${transaction.categoriaId}_${dia}`;
      
      if (!blueprintGroups.has(key)) {
        blueprintGroups.set(key, []);
      }
      blueprintGroups.get(key)!.push(transaction);
    });
    
    // Criar blueprints a partir dos grupos
    blueprintGroups.forEach((transactions, key) => {
      const firstTransaction = transactions[0];
      const [ano, mes, dia] = firstTransaction.data.split('-').map(Number);
      
      // Detectar se é valor fixo (todas as transações têm o mesmo valor)
      const valores = transactions.map(t => t.valor);
      const isValorFixo = valores.every(v => v === valores[0]);
      
      const blueprint: RecurringBlueprint = {
        id: `migrated_${Date.now()}_${key}`,
        itemId: firstTransaction.categoriaId,
        valor: isValorFixo ? firstTransaction.valor : 0,
        isValorFixo,
        diaVencimento: dia,
        dataInicio: firstTransaction.data,
        dataFim: `${ano}-12-31`,
        observacoes: firstTransaction.observacoes || 'Migrado do sistema anterior',
        userId: 'user1',
        criadoEm: getCurrentDateString()
      };
      
      this.saveBlueprint(blueprint);
      console.log(`Blueprint migrado: ${firstTransaction.descricao} (${isValorFixo ? 'Valor Fixo' : 'Valor Variável'})`);
    });
    
    console.log('Migração concluída');
  }
  
  /**
   * LIMPEZA DE DUPLICAÇÕES EXISTENTES
   * Remove todas as duplicações causadas pelo sistema anterior
   */
  static cleanDuplicatedTransactions(): void {
    console.log('Iniciando limpeza de duplicações...');
    
    const transactions = this.loadTransactions();
    const oldTransactions = JSON.parse(localStorage.getItem('lunari_transactions') || '[]');
    
    // Identificar duplicações baseadas em itemId + dataVencimento
    const seen = new Set<string>();
    const cleanTransactions: BlueprintTransaction[] = [];
    const cleanOldTransactions: any[] = [];
    
    // Limpar transações do novo sistema
    transactions.forEach(transaction => {
      const key = `${transaction.itemId}_${transaction.dataVencimento}`;
      if (!seen.has(key)) {
        seen.add(key);
        cleanTransactions.push(transaction);
      }
    });
    
    // Limpar transações do sistema antigo
    const oldSeen = new Set<string>();
    oldTransactions.forEach((transaction: any) => {
      const key = `${transaction.categoriaId}_${transaction.data}`;
      if (!oldSeen.has(key)) {
        oldSeen.add(key);
        cleanOldTransactions.push(transaction);
      }
    });
    
    // Salvar dados limpos
    localStorage.setItem(BLUEPRINT_STORAGE_KEYS.TRANSACTIONS, JSON.stringify(cleanTransactions));
    localStorage.setItem('lunari_transactions', JSON.stringify(cleanOldTransactions));
    
    console.log(`Duplicações removidas. Transações limpas: ${cleanTransactions.length}`);
  }
  
  // ============= FUNÇÕES AUXILIARES =============
  
  private static determineStatus(dataVencimento: string): 'Agendado' | 'Faturado' | 'Pago' {
    const hoje = getCurrentDateString();
    
    if (dataVencimento > hoje) {
      return 'Agendado';
    } else if (dataVencimento === hoje) {
      return 'Faturado';
    } else {
      return 'Faturado'; // Vencido - usuário deve marcar como pago manualmente
    }
  }
  
  private static isBlueprintActiveForMonth(blueprint: RecurringBlueprint, year: number, month: number): boolean {
    const [anoInicio, mesInicio] = blueprint.dataInicio.split('-').map(Number);
    const [anoFim, mesFim] = blueprint.dataFim.split('-').map(Number);
    
    const targetDate = new Date(Date.UTC(year, month - 1, 1));
    const startDate = new Date(Date.UTC(anoInicio, mesInicio - 1, 1));
    const endDate = new Date(Date.UTC(anoFim, mesFim - 1, 1));
    
    return targetDate >= startDate && targetDate <= endDate;
  }
  
  private static calculateDateForMonth(blueprint: RecurringBlueprint, year: number, month: number): string {
    // Calcular último dia do mês para ajustar se necessário
    const ultimoDiaMes = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const diaVencimento = Math.min(blueprint.diaVencimento, ultimoDiaMes);
    
    return `${year}-${month.toString().padStart(2, '0')}-${diaVencimento.toString().padStart(2, '0')}`;
  }
  
  // ============= FUNÇÕES DE PERSISTÊNCIA =============
  
  static saveBlueprint(blueprint: RecurringBlueprint): void {
    const blueprints = this.loadBlueprints();
    const updated = [...blueprints, blueprint];
    localStorage.setItem(BLUEPRINT_STORAGE_KEYS.BLUEPRINTS, JSON.stringify(updated));
  }
  
  static loadBlueprints(): RecurringBlueprint[] {
    try {
      const data = localStorage.getItem(BLUEPRINT_STORAGE_KEYS.BLUEPRINTS);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Erro ao carregar blueprints:', error);
      return [];
    }
  }
  
  static saveTransaction(transaction: BlueprintTransaction): void {
    const transactions = this.loadTransactions();
    const updated = [...transactions, transaction];
    localStorage.setItem(BLUEPRINT_STORAGE_KEYS.TRANSACTIONS, JSON.stringify(updated));
  }
  
  static loadTransactions(): BlueprintTransaction[] {
    try {
      const data = localStorage.getItem(BLUEPRINT_STORAGE_KEYS.TRANSACTIONS);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Erro ao carregar transações:', error);
      return [];
    }
  }
  
  static updateTransaction(id: string, updates: Partial<BlueprintTransaction>): void {
    const transactions = this.loadTransactions();
    const index = transactions.findIndex(t => t.id === id);
    
    if (index !== -1) {
      transactions[index] = { ...transactions[index], ...updates };
      
      // Se a data foi alterada, recalcular o status
      if (updates.dataVencimento) {
        transactions[index].status = this.determineStatus(updates.dataVencimento);
      }
      
      localStorage.setItem(BLUEPRINT_STORAGE_KEYS.TRANSACTIONS, JSON.stringify(transactions));
    }
  }
  
  static removeTransaction(id: string): void {
    const transactions = this.loadTransactions();
    const transaction = transactions.find(t => t.id === id);
    
    // Se é uma transação de blueprint, registrar como exclusão intencional
    if (transaction?.blueprintId) {
      this.addExcludedTransaction(transaction.blueprintId, transaction.dataVencimento);
      console.log(`Transação excluída intencionalmente: ${transaction.blueprintId} em ${transaction.dataVencimento}`);
    }
    
    const filtered = transactions.filter(t => t.id !== id);
    localStorage.setItem(BLUEPRINT_STORAGE_KEYS.TRANSACTIONS, JSON.stringify(filtered));
  }
  
  static removeBlueprint(id: string): void {
    const blueprints = this.loadBlueprints();
    const filtered = blueprints.filter(b => b.id !== id);
    localStorage.setItem(BLUEPRINT_STORAGE_KEYS.BLUEPRINTS, JSON.stringify(filtered));
    
    // Remover também todas as transações relacionadas
    const transactions = this.loadTransactions();
    const filteredTransactions = transactions.filter(t => t.blueprintId !== id);
    localStorage.setItem(BLUEPRINT_STORAGE_KEYS.TRANSACTIONS, JSON.stringify(filteredTransactions));
  }
  
  // ============= SISTEMA DE EXCLUSÕES INTENCIONAIS =============
  
  static addExcludedTransaction(blueprintId: string, dataVencimento: string): void {
    const excluded = this.loadExcludedTransactions();
    const key = `${blueprintId}_${dataVencimento}`;
    
    if (!excluded.includes(key)) {
      excluded.push(key);
      localStorage.setItem(BLUEPRINT_STORAGE_KEYS.EXCLUDED_TRANSACTIONS, JSON.stringify(excluded));
    }
  }
  
  static isTransactionExcluded(blueprintId: string, dataVencimento: string): boolean {
    const excluded = this.loadExcludedTransactions();
    const key = `${blueprintId}_${dataVencimento}`;
    return excluded.includes(key);
  }
  
  static loadExcludedTransactions(): string[] {
    try {
      const data = localStorage.getItem(BLUEPRINT_STORAGE_KEYS.EXCLUDED_TRANSACTIONS);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Erro ao carregar exclusões:', error);
      return [];
    }
  }
  
  static removeExcludedTransaction(blueprintId: string, dataVencimento: string): void {
    const excluded = this.loadExcludedTransactions();
    const key = `${blueprintId}_${dataVencimento}`;
    const filtered = excluded.filter(item => item !== key);
    localStorage.setItem(BLUEPRINT_STORAGE_KEYS.EXCLUDED_TRANSACTIONS, JSON.stringify(filtered));
  }

  /**
   * FUNÇÃO DE EMERGÊNCIA - Limpar todos os dados
   */
  static clearAllData(): void {
    localStorage.removeItem(BLUEPRINT_STORAGE_KEYS.BLUEPRINTS);
    localStorage.removeItem(BLUEPRINT_STORAGE_KEYS.TRANSACTIONS);
    localStorage.removeItem(BLUEPRINT_STORAGE_KEYS.EXCLUDED_TRANSACTIONS);
    console.log('Todos os dados de blueprints foram limpos');
  }
}