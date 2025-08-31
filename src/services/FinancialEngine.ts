/**
 * MOTOR DE LÓGICA FINANCEIRA CENTRALIZADO
 * 
 * Este motor implementa as regras de negócio para criação de transações:
 * - Lançamentos únicos
 * - Lançamentos parcelados (com prioridade sobre recorrentes)
 * - Lançamentos recorrentes (modelo blueprint + geração just-in-time)
 * - Tratamento de datas com tolerância zero para fuso horário
 */

import { formatDateForStorage, getCurrentDateString } from '@/utils/dateUtils';

// ============= ESTRUTURAS DE DADOS OBRIGATÓRIAS =============

export interface FinancialTransaction {
  id: string;
  itemId: string;
  valor: number;
  dataVencimento: string; // Formato YYYY-MM-DD OBRIGATÓRIO
  status: 'Agendado' | 'Faturado' | 'Pago'; // Sistema de 3 níveis
  observacoes?: string;
  parcelaInfo?: { atual: number; total: number } | null;
  recurringTemplateId?: string; // ID do modelo que gerou esta transação
  parentId?: string; // Para compatibilidade com sistema existente
  cartaoCreditoId?: string; // ID do cartão de crédito, se aplicável
  dataCompra?: string; // Data original da compra (para cartão de crédito) - Formato YYYY-MM-DD
}

export interface RecurringTemplate {
  id: string;
  itemId: string;
  valor: number;
  diaVencimento: number; // Dia do mês (1-31)
  dataInicio: string; // Formato YYYY-MM-DD
  dataFim: string; // Formato YYYY-MM-DD
  isValorFixo: boolean; // Distingue entre valor fixo (ex: Aluguel) e variável (ex: Energia)
}

export interface CreateTransactionInput {
  valorTotal: number;
  dataPrimeiraOcorrencia: string; // Formato YYYY-MM-DD
  itemId: string;
  isRecorrente: boolean;
  isParcelado: boolean;
  numeroDeParcelas?: number;
  observacoes?: string;
  isValorFixo?: boolean; // Para despesas recorrentes: true = valor fixo, false = valor variável
  cartaoCreditoId?: string; // ID do cartão de crédito, se aplicável
}

// Nova interface para cartões de crédito
export interface CreditCard {
  id: string;
  nome: string;
  diaVencimento: number; // Dia do mês (1-31)
  diaFechamento: number; // Dia do mês (1-31)
  userId: string;
  ativo: boolean;
  criadoEm: string;
}

// ============= CHAVES DE LOCALSTORAGE =============

export const FINANCIAL_STORAGE_KEYS = {
  TRANSACTIONS: 'lunari_fin_transactions',
  RECURRING_TEMPLATES: 'lunari_fin_recurring_templates',
  CREDIT_CARDS: 'lunari_fin_credit_cards'
} as const;

// ============= MOTOR PRINCIPAL =============

export class FinancialEngine {
  
  /**
   * FUNÇÃO PRINCIPAL - Motor de Criação de Transações Centralizado
   * Implementa REGRAS INEGOCIÁVEIS conforme especificação
   */
  static createTransactions(input: CreateTransactionInput): {
    transactions: FinancialTransaction[];
    recurringTemplate?: RecurringTemplate;
  } {
    const { valorTotal, dataPrimeiraOcorrencia, itemId, isRecorrente, isParcelado, numeroDeParcelas, observacoes, isValorFixo, cartaoCreditoId } = input;

    // Validações básicas
    if (!itemId || valorTotal <= 0) {
      throw new Error('Dados inválidos: itemId e valor são obrigatórios');
    }

    // Garantir formato correto da data (REGRA D)
    const dataFormatada = formatDateForStorage(dataPrimeiraOcorrencia);

    // NOVA: Lógica de Cartão de Crédito (prioridade máxima)
    if (cartaoCreditoId) {
      return this.createCreditCardTransactions({
        valorTotal,
        dataPrimeiraOcorrencia: dataFormatada,
        itemId,
        cartaoCreditoId,
        numeroDeParcelas,
        observacoes
      });
    }

    // REGRA A: Lógica de Parcelamento Precisa (prioridade sobre recorrente)
    if (isParcelado && numeroDeParcelas && numeroDeParcelas > 1) {
      return this.createParceledTransactions({
        valorTotal,
        dataPrimeiraOcorrencia: dataFormatada,
        itemId,
        numeroDeParcelas,
        observacoes
      });
    }

    // REGRA B: Lógica de Recorrência "Blueprint"
    if (isRecorrente) {
      return this.createRecurringTransaction({
        valorTotal,
        dataPrimeiraOcorrencia: dataFormatada,
        itemId,
        observacoes,
        isValorFixo: isValorFixo ?? true // Default para valor fixo se não especificado
      });
    }

    // Lançamento único
    return {
      transactions: [this.createSingleTransaction({
        valorTotal,
        dataPrimeiraOcorrencia: dataFormatada,
        itemId,
        observacoes
      })]
    };
  }

  /**
   * REGRA A: Implementação do Parcelamento Preciso
   */
  private static createParceledTransactions(params: {
    valorTotal: number;
    dataPrimeiraOcorrencia: string;
    itemId: string;
    numeroDeParcelas: number;
    observacoes?: string;
  }): { transactions: FinancialTransaction[] } {
    
    const { valorTotal, dataPrimeiraOcorrencia, itemId, numeroDeParcelas, observacoes } = params;
    
    // Primeira operação: cálculo do valor da parcela
    const valorDaParcela = valorTotal / numeroDeParcelas;
    
    const transactions: FinancialTransaction[] = [];
    const parentId = `parcela_${Date.now()}`;

    // Loop que executa numeroDeParcelas vezes
    for (let i = 0; i < numeroDeParcelas; i++) {
      const dataVencimento = this.calculateParcelDate(dataPrimeiraOcorrencia, i);
      
      const transaction: FinancialTransaction = {
        id: `${parentId}_${i + 1}`,
        itemId,
        valor: valorDaParcela,
        dataVencimento,
        status: this.determineStatus(dataVencimento),
        parcelaInfo: { atual: i + 1, total: numeroDeParcelas },
        observacoes: observacoes ? `${observacoes} (${i + 1}/${numeroDeParcelas})` : `(${i + 1}/${numeroDeParcelas})`
      };
      
      transactions.push(transaction);
    }

    return { transactions };
  }

  /**
   * REGRA B: Implementação da Recorrência Blueprint
   */
  private static createRecurringTransaction(params: {
    valorTotal: number;
    dataPrimeiraOcorrencia: string;
    itemId: string;
    observacoes?: string;
    isValorFixo: boolean;
  }): { transactions: FinancialTransaction[]; recurringTemplate: RecurringTemplate } {
    
    const { valorTotal, dataPrimeiraOcorrencia, itemId, observacoes, isValorFixo } = params;
    
    const [ano, , dia] = dataPrimeiraOcorrencia.split('-').map(Number);
    const dataFim = `${ano}-12-31`; // Último dia do ano corrente
    
    // Criar modelo de recorrência
    const recurringTemplate: RecurringTemplate = {
      id: `recurring_${Date.now()}`,
      itemId,
      valor: isValorFixo ? valorTotal : 0, // Se valor variável, salvar 0 no template
      diaVencimento: dia,
      dataInicio: dataPrimeiraOcorrencia,
      dataFim,
      isValorFixo
    };

    // CORREÇÃO CRÍTICA: Gerar primeira transação com valor digitado pelo usuário
    const firstTransaction: FinancialTransaction = {
      id: `${recurringTemplate.id}_primeira`,
      itemId,
      valor: valorTotal, // SEMPRE usar o valor digitado pelo usuário na primeira transação
      dataVencimento: dataPrimeiraOcorrencia,
      status: this.determineStatus(dataPrimeiraOcorrencia),
      recurringTemplateId: recurringTemplate.id,
      observacoes: isValorFixo 
        ? (observacoes ? `${observacoes} (Recorrente - Valor Fixo)` : 'Recorrente - Valor Fixo')
        : (observacoes ? `${observacoes} (Recorrente - Editar Valor)` : 'Recorrente - Editar Valor')
    };

    return { 
      transactions: [firstTransaction], 
      recurringTemplate 
    };
  }

  /**
   * Criação de transação única
   */
  private static createSingleTransaction(params: {
    valorTotal: number;
    dataPrimeiraOcorrencia: string;
    itemId: string;
    observacoes?: string;
  }): FinancialTransaction {
    
    const { valorTotal, dataPrimeiraOcorrencia, itemId, observacoes } = params;
    
    return {
      id: `single_${Date.now()}`,
      itemId,
      valor: valorTotal,
      dataVencimento: dataPrimeiraOcorrencia,
      status: this.determineStatus(dataPrimeiraOcorrencia),
      observacoes
    };
  }

  /**
   * REGRA C: Geração Just-in-Time para Recorrências
   * Esta função deve ser chamada ao exibir dados de um mês específico
   */
  static generateRecurringTransactionsForMonth(
    templates: RecurringTemplate[],
    existingTransactions: FinancialTransaction[],
    targetYear: number,
    targetMonth: number
  ): FinancialTransaction[] {
    
    const newTransactions: FinancialTransaction[] = [];

    templates.forEach(template => {
      // Verificar se o template está ativo para o mês/ano solicitado
      if (!this.isTemplateActiveForMonth(template, targetYear, targetMonth)) {
        return;
      }

      // Verificar se já existe transação para este template no mês
      const expectedDate = this.calculateRecurringDateForMonth(template, targetYear, targetMonth);
      const existingTransaction = existingTransactions.find(t => 
        t.recurringTemplateId === template.id && t.dataVencimento === expectedDate
      );

      // Se não existe, criar nova transação
      if (!existingTransaction) {
        const newTransaction: FinancialTransaction = {
          id: `${template.id}_${targetYear}_${targetMonth}`,
          itemId: template.itemId,
          valor: template.isValorFixo ? template.valor : 0, // Se valor variável, criar com valor 0
          dataVencimento: expectedDate,
          status: this.determineStatus(expectedDate),
          recurringTemplateId: template.id,
          observacoes: template.isValorFixo 
            ? 'Recorrente - Valor Fixo'
            : 'Recorrente - Editar Valor'
        };

        newTransactions.push(newTransaction);
      }
    });

    return newTransactions;
  }

  // ============= FUNÇÕES AUXILIARES =============

  /**
   * REGRA D: Cálculo de data para parcelas (tolerância zero com fuso horário)
   */
  private static calculateParcelDate(dataInicial: string, indiceParcela: number): string {
    const [ano, mes, dia] = dataInicial.split('-').map(Number);
    
    // Usar Date.UTC para ignorar fuso horário local (REGRA D)
    const utcDate = new Date(Date.UTC(ano, mes - 1 + indiceParcela, dia));
    
    // Ajustar para último dia do mês se necessário
    const ultimoDiaMes = new Date(Date.UTC(utcDate.getUTCFullYear(), utcDate.getUTCMonth() + 1, 0)).getUTCDate();
    if (dia > ultimoDiaMes) {
      utcDate.setUTCDate(ultimoDiaMes);
    }
    
    return formatDateForStorage(utcDate);
  }

  /**
   * NOVA: Criar transações de cartão de crédito
   */
  private static createCreditCardTransactions(params: {
    valorTotal: number;
    dataPrimeiraOcorrencia: string;
    itemId: string;
    cartaoCreditoId: string;
    numeroDeParcelas?: number;
    observacoes?: string;
  }): { transactions: FinancialTransaction[] } {
    
    const { valorTotal, dataPrimeiraOcorrencia, itemId, cartaoCreditoId, numeroDeParcelas, observacoes } = params;
    
    // Carregar dados do cartão
    const cartao = this.loadCreditCards().find(c => c.id === cartaoCreditoId);
    if (!cartao) {
      throw new Error('Cartão de crédito não encontrado');
    }

    const transactions: FinancialTransaction[] = [];
    const parcelas = numeroDeParcelas || 1;
    const valorDaParcela = valorTotal / parcelas;
    const parentId = `cartao_${Date.now()}`;

    for (let i = 0; i < parcelas; i++) {
      const dataVencimento = this.calculateCreditCardDueDate(dataPrimeiraOcorrencia, cartao, i);
      
      const transaction: FinancialTransaction = {
        id: `${parentId}_${i + 1}`,
        itemId,
        valor: valorDaParcela,
        dataVencimento,
        status: this.determineStatus(dataVencimento),
        cartaoCreditoId,
        dataCompra: dataPrimeiraOcorrencia, // PRESERVAR data original da compra
        parcelaInfo: parcelas > 1 ? { atual: i + 1, total: parcelas } : null,
        observacoes: observacoes ? `${observacoes} (Cartão: ${cartao.nome})` : `Cartão: ${cartao.nome}`
      };
      
      transactions.push(transaction);
    }

    return { transactions };
  }

  /**
   * Calcular data de vencimento para cartão de crédito
   * Implementação corrigida para cálculo preciso de parcelas
   */
  private static calculateCreditCardDueDate(dataCompra: string, cartao: CreditCard, parcelaIndex: number): string {
    const [ano, mes, dia] = dataCompra.split('-').map(Number);
    
    // 1. Determinar o período da fatura (qual fatura a compra pertence)
    let mesPeriodoFatura = mes;
    let anoPeriodoFatura = ano;
    
    // Se compra após fechamento, vai para período da próxima fatura
    if (dia > cartao.diaFechamento) {
      mesPeriodoFatura++;
      if (mesPeriodoFatura > 12) {
        mesPeriodoFatura = 1;
        anoPeriodoFatura++;
      }
    }
    
    // 2. CORREÇÃO: Fatura sempre vence NO MÊS SEGUINTE ao período
    let mesVencimentoPrimeiraFatura = mesPeriodoFatura + 1;
    let anoVencimentoPrimeiraFatura = anoPeriodoFatura;
    
    if (mesVencimentoPrimeiraFatura > 12) {
      mesVencimentoPrimeiraFatura = 1;
      anoVencimentoPrimeiraFatura++;
    }
    
    // 3. Calcular vencimento da parcela atual
    let mesVencimento = mesVencimentoPrimeiraFatura + parcelaIndex;
    let anoVencimento = anoVencimentoPrimeiraFatura;
    
    while (mesVencimento > 12) {
      mesVencimento -= 12;
      anoVencimento++;
    }
    
    // 4. Dia de vencimento
    const ultimoDiaMes = new Date(anoVencimento, mesVencimento, 0).getDate();
    const diaVencimento = Math.min(cartao.diaVencimento, ultimoDiaMes);
    
    return `${anoVencimento}-${mesVencimento.toString().padStart(2, '0')}-${diaVencimento.toString().padStart(2, '0')}`;
  }

  /**
   * SISTEMA DE 3 NÍVEIS: Determinar status automático baseado na data
   */
  private static determineStatus(dataVencimento: string): 'Agendado' | 'Faturado' | 'Pago' {
    const hoje = getCurrentDateString();
    
    if (dataVencimento > hoje) {
      return 'Agendado';
    } else if (dataVencimento === hoje) {
      return 'Faturado'; // Vence hoje - automático
    } else {
      return 'Faturado'; // Venceu - precisa ser marcado como pago manualmente
    }
  }

  /**
   * Verificar se template está ativo para um mês específico
   */
  private static isTemplateActiveForMonth(template: RecurringTemplate, year: number, month: number): boolean {
    const [anoInicio, mesInicio] = template.dataInicio.split('-').map(Number);
    const [anoFim, mesFim] = template.dataFim.split('-').map(Number);
    
    const targetDate = new Date(Date.UTC(year, month - 1, 1));
    const startDate = new Date(Date.UTC(anoInicio, mesInicio - 1, 1));
    const endDate = new Date(Date.UTC(anoFim, mesFim - 1, 1));
    
    return targetDate >= startDate && targetDate <= endDate;
  }

  /**
   * Calcular data de vencimento para recorrência em mês específico
   */
  private static calculateRecurringDateForMonth(template: RecurringTemplate, year: number, month: number): string {
    // Calcular último dia do mês para ajustar se necessário
    const ultimoDiaMes = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const diaVencimento = Math.min(template.diaVencimento, ultimoDiaMes);
    
    return `${year}-${month.toString().padStart(2, '0')}-${diaVencimento.toString().padStart(2, '0')}`;
  }

  // ============= FUNÇÕES DE PERSISTÊNCIA =============

  /**
   * Salvar transações no localStorage
   */
  static saveTransactions(transactions: FinancialTransaction[]): void {
    const existing = this.loadTransactions();
    const combined = [...existing, ...transactions];
    localStorage.setItem(FINANCIAL_STORAGE_KEYS.TRANSACTIONS, JSON.stringify(combined));
  }

  /**
   * Carregar transações do localStorage
   */
  static loadTransactions(): FinancialTransaction[] {
    try {
      const data = localStorage.getItem(FINANCIAL_STORAGE_KEYS.TRANSACTIONS);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Erro ao carregar transações:', error);
      return [];
    }
  }

  /**
   * Salvar templates recorrentes no localStorage
   */
  static saveRecurringTemplates(templates: RecurringTemplate[]): void {
    const existing = this.loadRecurringTemplates();
    const combined = [...existing, ...templates];
    localStorage.setItem(FINANCIAL_STORAGE_KEYS.RECURRING_TEMPLATES, JSON.stringify(combined));
  }

  /**
   * Carregar templates recorrentes do localStorage
   */
  static loadRecurringTemplates(): RecurringTemplate[] {
    try {
      const data = localStorage.getItem(FINANCIAL_STORAGE_KEYS.RECURRING_TEMPLATES);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Erro ao carregar templates recorrentes:', error);
      return [];
    }
  }

  /**
   * Atualizar uma transação específica
   */
  static updateTransaction(id: string, updates: Partial<FinancialTransaction>): void {
    const transactions = this.loadTransactions();
    const index = transactions.findIndex(t => t.id === id);
    
    if (index !== -1) {
      transactions[index] = { ...transactions[index], ...updates };
      
      // Se a data foi alterada, recalcular o status
      if (updates.dataVencimento) {
        transactions[index].status = this.determineStatus(updates.dataVencimento);
      }
      
      localStorage.setItem(FINANCIAL_STORAGE_KEYS.TRANSACTIONS, JSON.stringify(transactions));
    }
  }

  /**
   * Remover uma transação
   */
  static removeTransaction(id: string): void {
    const transactions = this.loadTransactions();
    const filtered = transactions.filter(t => t.id !== id);
    localStorage.setItem(FINANCIAL_STORAGE_KEYS.TRANSACTIONS, JSON.stringify(filtered));
  }

  /**
   * NOVA: Salvar cartões de crédito no localStorage
   */
  static saveCreditCards(cards: CreditCard[]): void {
    const existing = this.loadCreditCards();
    const combined = [...existing, ...cards];
    localStorage.setItem(FINANCIAL_STORAGE_KEYS.CREDIT_CARDS, JSON.stringify(combined));
  }

  /**
   * NOVA: Carregar cartões de crédito do localStorage
   */
  static loadCreditCards(): CreditCard[] {
    try {
      const data = localStorage.getItem(FINANCIAL_STORAGE_KEYS.CREDIT_CARDS);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Erro ao carregar cartões de crédito:', error);
      return [];
    }
  }

  /**
   * NOVA: Adicionar um novo cartão de crédito
   */
  static addCreditCard(card: Omit<CreditCard, 'id' | 'criadoEm'>): CreditCard {
    const newCard: CreditCard = {
      ...card,
      id: `card_${Date.now()}`,
      criadoEm: getCurrentDateString()
    };
    
    const existing = this.loadCreditCards();
    const updated = [...existing, newCard];
    localStorage.setItem(FINANCIAL_STORAGE_KEYS.CREDIT_CARDS, JSON.stringify(updated));
    
    return newCard;
  }

  /**
   * NOVA: Remover cartão de crédito
   */
  static removeCreditCard(id: string): void {
    const cards = this.loadCreditCards();
    const filtered = cards.filter(c => c.id !== id);
    localStorage.setItem(FINANCIAL_STORAGE_KEYS.CREDIT_CARDS, JSON.stringify(filtered));
  }

  /**
   * NOVA: Marcar transação como paga (transição manual)
   */
  static markAsPaid(transactionId: string): void {
    const transactions = this.loadTransactions();
    const index = transactions.findIndex(t => t.id === transactionId);
    
    if (index !== -1 && transactions[index].status === 'Faturado') {
      transactions[index].status = 'Pago';
      localStorage.setItem(FINANCIAL_STORAGE_KEYS.TRANSACTIONS, JSON.stringify(transactions));
    }
  }

  /**
   * NOVA: Atualizar status automático para todas as transações
   */
  static updateAllStatuses(): void {
    const transactions = this.loadTransactions();
    let hasChanges = false;
    
    transactions.forEach(transaction => {
      const newStatus = this.determineStatus(transaction.dataVencimento);
      if (transaction.status !== 'Pago' && transaction.status !== newStatus) {
        transaction.status = newStatus;
        hasChanges = true;
      }
    });
    
    if (hasChanges) {
      localStorage.setItem(FINANCIAL_STORAGE_KEYS.TRANSACTIONS, JSON.stringify(transactions));
    }
  }

  /**
   * NOVA: Migração para adicionar dataCompra em transações existentes de cartão
   */
  static migrateExistingCreditCardTransactions(): void {
    const transactions = this.loadTransactions();
    const cards = this.loadCreditCards();
    let hasChanges = false;

    transactions.forEach(transaction => {
      // Se é transação de cartão e não tem dataCompra
      if (transaction.cartaoCreditoId && !transaction.dataCompra) {
        const cartao = cards.find(c => c.id === transaction.cartaoCreditoId);
        if (cartao) {
          // Calcular data provável da compra baseado no vencimento da fatura
          const dataCompraCalculada = this.calculatePurchaseDateFromDueDate(
            transaction.dataVencimento, 
            cartao
          );
          
          transaction.dataCompra = dataCompraCalculada;
          hasChanges = true;
        }
      }
    });

    if (hasChanges) {
      localStorage.setItem(FINANCIAL_STORAGE_KEYS.TRANSACTIONS, JSON.stringify(transactions));
      console.log('Migração de dataCompra concluída para transações existentes');
    }
  }

  /**
   * Calcular data provável da compra baseado na data de vencimento da fatura
   */
  private static calculatePurchaseDateFromDueDate(dataVencimento: string, cartao: CreditCard): string {
    const [ano, mes, dia] = dataVencimento.split('-').map(Number);
    
    // Fatura vence no mês seguinte ao período
    // Então a compra provavelmente foi no mês anterior
    let mesCompra = mes - 1;
    let anoCompra = ano;
    
    if (mesCompra < 1) {
      mesCompra = 12;
      anoCompra--;
    }
    
    // Assumir que a compra foi no dia de fechamento (estimativa conservadora)
    const diaCompra = Math.min(cartao.diaFechamento, new Date(anoCompra, mesCompra, 0).getDate());
    
    return `${anoCompra}-${mesCompra.toString().padStart(2, '0')}-${diaCompra.toString().padStart(2, '0')}`;
  }

  /**
   * Limpar todos os dados (função de emergência)
   */
  static clearAllData(): void {
    localStorage.removeItem(FINANCIAL_STORAGE_KEYS.TRANSACTIONS);
    localStorage.removeItem(FINANCIAL_STORAGE_KEYS.RECURRING_TEMPLATES);
    localStorage.setItem(FINANCIAL_STORAGE_KEYS.CREDIT_CARDS, JSON.stringify([]));
  }
}