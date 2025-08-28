import { storage } from '@/utils/localStorage';
import { getCurrentDateString } from '@/utils/dateUtils';
import { ItemFinanceiro, GrupoPrincipal } from '@/types/financas';
import { GastoItem } from '@/types/precificacao';
import { RecurringBlueprintEngine } from '@/services/RecurringBlueprintEngine';

// ============= SERVIÇO DE INTEGRAÇÃO PRECIFICAÇÃO-FINANCEIRO =============

export interface DespesaFixaFinanceira {
  id: string;
  nome: string;
  grupo_principal: 'Despesa Fixa';
  grupoPrincipal: 'Despesa Fixa';
  userId: string;
  ativo: boolean;
  criadoEm: string;
  valorMedio?: number; // Calculado dos últimos meses
  transacoesCount?: number;
}

export interface CustoEstudioPrecificacao {
  id: string;
  descricao: string;
  valor: number;
  origem?: 'manual' | 'financeiro';
  itemFinanceiroId?: string;
}

export interface SyncPreview {
  item: DespesaFixaFinanceira;
  valorFinanceiro: number;
  valorPrecificacao?: number;
  acao: 'adicionar' | 'atualizar' | 'manter';
  diferenca?: number;
}

class PricingFinancialIntegrationService {
  private readonly STORAGE_KEYS = {
    FINANCIAL_ITEMS: 'lunari_fin_items',
    PRICING_COSTS: 'lunari_pricing_fixed_costs',
    TRANSACTIONS: 'lunari_fin_transactions' // Use same key as RecurringBlueprintEngine
  };

  // ============= IMPORTAÇÃO DE DESPESAS FIXAS =============

  /**
   * Busca todas as despesas fixas do sistema financeiro
   */
  getDespesasFixasFromFinancial(): DespesaFixaFinanceira[] {
    const itensFinanceiros = storage.load(this.STORAGE_KEYS.FINANCIAL_ITEMS, []);
    
    return itensFinanceiros
      .filter((item: ItemFinanceiro) => item.grupo_principal === 'Despesa Fixa' && item.ativo)
      .map((item: ItemFinanceiro) => ({
        id: item.id,
        nome: item.nome,
        grupo_principal: 'Despesa Fixa' as const,
        grupoPrincipal: 'Despesa Fixa' as const,
        userId: item.userId,
        ativo: item.ativo,
        criadoEm: item.criadoEm,
        valorMedio: this.calculateAverageValueFromHistory(item.id),
        transacoesCount: this.getTransactionCount(item.id)
      }));
  }

  /**
   * Calcula valor médio dos últimos 6 meses para um item financeiro
   */
  private calculateAverageValueFromHistory(itemId: string, meses: number = 6): number {
    const transacoes = storage.load(this.STORAGE_KEYS.TRANSACTIONS, []);
    const hoje = new Date();
    const dataLimite = new Date(hoje.getFullYear(), hoje.getMonth() - meses, 1);
    
    const transacoesRelevantes = transacoes.filter((t: any) => {
      if (t.itemId !== itemId) return false;
      if (t.status !== 'Pago') return false; // Apenas transações pagas
      
      const dataTransacao = new Date(t.dataVencimento);
      return dataTransacao >= dataLimite;
    });

    if (transacoesRelevantes.length === 0) return 0;

    const total = transacoesRelevantes.reduce((sum: number, t: any) => sum + t.valor, 0);
    return Number((total / transacoesRelevantes.length).toFixed(2));
  }

  /**
   * Conta número de transações de um item nos últimos 6 meses
   */
  private getTransactionCount(itemId: string): number {
    const transacoes = storage.load(this.STORAGE_KEYS.TRANSACTIONS, []);
    const hoje = new Date();
    const dataLimite = new Date(hoje.getFullYear(), hoje.getMonth() - 6, 1);
    
    return transacoes.filter((t: any) => {
      if (t.itemId !== itemId) return false;
      const dataTransacao = new Date(t.dataVencimento);
      return dataTransacao >= dataLimite;
    }).length;
  }

  // ============= GERENCIAMENTO DE CUSTOS DA PRECIFICAÇÃO =============

  /**
   * Busca custos do estúdio da precificação
   */
  getCustosEstudioFromPricing(): CustoEstudioPrecificacao[] {
    const dados = storage.load(this.STORAGE_KEYS.PRICING_COSTS, {});
    return (dados as any).custosEstudio || [];
  }

  /**
   * Salva custos do estúdio na precificação
   */
  saveCustosEstudioToPricing(custos: CustoEstudioPrecificacao[]): void {
    const dados = storage.load(this.STORAGE_KEYS.PRICING_COSTS, {});
    const dadosAtualizados = { ...dados, custosEstudio: custos };
    storage.save(this.STORAGE_KEYS.PRICING_COSTS, dadosAtualizados);
  }

  // ============= SINCRONIZAÇÃO E PREVIEW =============

  /**
   * Gera preview da sincronização entre financeiro e precificação
   */
  generateSyncPreview(): SyncPreview[] {
    const despesasFixas = this.getDespesasFixasFromFinancial();
    const custosEstudio = this.getCustosEstudioFromPricing();

    return despesasFixas.map(despesa => {
      // Buscar se já existe custo correspondente na precificação
      const custoExistente = custosEstudio.find(custo => 
        custo.itemFinanceiroId === despesa.id || 
        custo.descricao.toLowerCase() === despesa.nome.toLowerCase()
      );

      const valorFinanceiro = despesa.valorMedio || 0;
      
      if (!custoExistente) {
        return {
          item: despesa,
          valorFinanceiro,
          acao: 'adicionar' as const
        };
      }

      const diferenca = Math.abs(valorFinanceiro - custoExistente.valor);
      const percentualDiferenca = custoExistente.valor > 0 ? (diferenca / custoExistente.valor) * 100 : 100;

      return {
        item: despesa,
        valorFinanceiro,
        valorPrecificacao: custoExistente.valor,
        acao: percentualDiferenca > 10 ? 'atualizar' as const : 'manter' as const,
        diferenca: valorFinanceiro - custoExistente.valor
      };
    });
  }

  /**
   * Executa sincronização baseada na seleção do usuário
   */
  executeSyncronization(selectedItems: string[], useAverageValue: boolean = true): {
    success: boolean;
    imported: number;
    updated: number;
    errors: string[];
  } {
    try {
      const despesasFixas = this.getDespesasFixasFromFinancial();
      const custosEstudio = this.getCustosEstudioFromPricing();
      const errors: string[] = [];
      let imported = 0;
      let updated = 0;

      const custosAtualizados = [...custosEstudio];

      selectedItems.forEach(itemId => {
        const despesa = despesasFixas.find(d => d.id === itemId);
        if (!despesa) {
          errors.push(`Despesa ${itemId} não encontrada`);
          return;
        }

        const valorParaUsar = useAverageValue ? despesa.valorMedio || 0 : 0;
        
        // Verificar se já existe
        const indexExistente = custosAtualizados.findIndex(custo => 
          custo.itemFinanceiroId === despesa.id || 
          custo.descricao.toLowerCase() === despesa.nome.toLowerCase()
        );

        if (indexExistente >= 0) {
          // Atualizar existente
          custosAtualizados[indexExistente] = {
            ...custosAtualizados[indexExistente],
            valor: valorParaUsar,
            origem: 'financeiro',
            itemFinanceiroId: despesa.id
          };
          updated++;
        } else {
          // Adicionar novo
          custosAtualizados.push({
            id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
            descricao: despesa.nome,
            valor: valorParaUsar,
            origem: 'financeiro',
            itemFinanceiroId: despesa.id
          });
          imported++;
        }
      });

      // Salvar custos atualizados
      this.saveCustosEstudioToPricing(custosAtualizados);

      return {
        success: true,
        imported,
        updated,
        errors
      };

    } catch (error) {
      console.error('Erro durante sincronização:', error);
      return {
        success: false,
        imported: 0,
        updated: 0,
        errors: [error instanceof Error ? error.message : 'Erro desconhecido']
      };
    }
  }

  // ============= SINCRONIZAÇÃO REVERSA (PRECIFICAÇÃO → FINANÇAS) =============

  /**
   * Busca custos da precificação para sincronizar com finanças
   */
  getCustosEstudioFromPricingForSync(): CustoEstudioPrecificacao[] {
    const dados = storage.load(this.STORAGE_KEYS.PRICING_COSTS, {});
    return (dados as any).custosEstudio || [];
  }

  /**
   * Gera preview da sincronização reversa (Precificação → Finanças)
   */
  generateReverseSyncPreview(): {
    custo: CustoEstudioPrecificacao;
    itemFinanceiroExistente?: ItemFinanceiro;
    acao: 'adicionar' | 'atualizar' | 'existe';
  }[] {
    const custosEstudio = this.getCustosEstudioFromPricingForSync();
    const itensFinanceiros = storage.load(this.STORAGE_KEYS.FINANCIAL_ITEMS, []);

    return custosEstudio.map(custo => {
      // Buscar se já existe item financeiro correspondente
      const itemExistente = itensFinanceiros.find((item: ItemFinanceiro) => 
        item.nome.toLowerCase() === custo.descricao.toLowerCase() && 
        item.grupo_principal === 'Despesa Fixa'
      );

      return {
        custo,
        itemFinanceiroExistente: itemExistente,
        acao: itemExistente ? 'existe' as const : 'adicionar' as const
      };
    });
  }

  /**
   * Executa sincronização reversa (Precificação → Finanças)
   */
  executeReverseSyncronization(selectedCustos: string[]): {
    success: boolean;
    created: number;
    errors: string[];
  } {
    try {
      const custosEstudio = this.getCustosEstudioFromPricingForSync();
      const itensFinanceiros = storage.load(this.STORAGE_KEYS.FINANCIAL_ITEMS, []);
      const errors: string[] = [];
      let created = 0;

      selectedCustos.forEach(custoId => {
        const custo = custosEstudio.find(c => c.id === custoId);
        if (!custo) {
          errors.push(`Custo ${custoId} não encontrado`);
          return;
        }

        // Verificar se já existe item financeiro correspondente
        const jaExiste = itensFinanceiros.some((item: ItemFinanceiro) => 
          item.nome.toLowerCase() === custo.descricao.toLowerCase() && 
          item.grupo_principal === 'Despesa Fixa'
        );

        if (!jaExiste) {
          const novoItem: ItemFinanceiro = {
            id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
            nome: custo.descricao,
            grupo_principal: 'Despesa Fixa',
            userId: 'user1',
            ativo: true,
            criadoEm: getCurrentDateString()
          };

          itensFinanceiros.push(novoItem);
          created++;
        }
      });

      if (created > 0) {
        storage.save(this.STORAGE_KEYS.FINANCIAL_ITEMS, itensFinanceiros);
      }

      return {
        success: true,
        created,
        errors
      };

    } catch (error) {
      console.error('Erro na sincronização reversa:', error);
      return {
        success: false,
        created: 0,
        errors: [error instanceof Error ? error.message : 'Erro desconhecido']
      };
    }
  }

  // ============= EXPORTAÇÃO PARA O FINANCEIRO =============

  /**
   * Cria itens financeiros baseados nos custos da precificação
   */
  exportCustosEstudioToFinancial(custos: CustoEstudioPrecificacao[]): {
    success: boolean;
    created: number;
    errors: string[];
  } {
    try {
      const itensFinanceiros = storage.load(this.STORAGE_KEYS.FINANCIAL_ITEMS, []);
      const errors: string[] = [];
      let created = 0;

      custos.forEach(custo => {
        // Verificar se já existe item financeiro correspondente
        const jaExiste = itensFinanceiros.some((item: ItemFinanceiro) => 
          item.nome.toLowerCase() === custo.descricao.toLowerCase() && 
          item.grupo_principal === 'Despesa Fixa'
        );

        if (!jaExiste) {
          const novoItem: ItemFinanceiro = {
            id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
            nome: custo.descricao,
            grupo_principal: 'Despesa Fixa',
            userId: 'user1',
            ativo: true,
            criadoEm: getCurrentDateString()
          };

          itensFinanceiros.push(novoItem);
          created++;
        }
      });

      if (created > 0) {
        storage.save(this.STORAGE_KEYS.FINANCIAL_ITEMS, itensFinanceiros);
      }

      return {
        success: true,
        created,
        errors
      };

    } catch (error) {
      console.error('Erro ao exportar para financeiro:', error);
      return {
        success: false,
        created: 0,
        errors: [error instanceof Error ? error.message : 'Erro desconhecido']
      };
    }
  }

  // ============= ANÁLISE COMPARATIVA =============

  /**
   * Compara valores planejados vs gastos reais
   */
  comparePricingVsActual(mesAno: { mes: number; ano: number }) {
    const custosEstudio = this.getCustosEstudioFromPricing();
    const transacoes = storage.load(this.STORAGE_KEYS.TRANSACTIONS, []);

    // Filtrar transações do mês
    const transacoesMes = transacoes.filter((t: any) => {
      const [ano, mes] = t.dataVencimento.split('-').map(Number);
      return mes === mesAno.mes && ano === mesAno.ano && t.status === 'Pago';
    });

    const comparativo = custosEstudio
      .filter(custo => custo.itemFinanceiroId) // Apenas custos com origem no financeiro
      .map(custo => {
        // Buscar transações do item financeiro correspondente
        const transacoesItem = transacoesMes.filter((t: any) => t.itemId === custo.itemFinanceiroId);
        const gastoReal = transacoesItem.reduce((sum: number, t: any) => sum + t.valor, 0);
        
        const diferenca = gastoReal - custo.valor;
        const percentualDiferenca = custo.valor > 0 ? (diferenca / custo.valor) * 100 : 0;

        return {
          descricao: custo.descricao,
          planejado: custo.valor,
          real: gastoReal,
          diferenca,
          percentualDiferenca,
          status: Math.abs(percentualDiferenca) > 20 ? 'alerta' : 
                  Math.abs(percentualDiferenca) > 10 ? 'atencao' : 'ok'
        };
      });

    const totais = {
      planejado: comparativo.reduce((sum, item) => sum + item.planejado, 0),
      real: comparativo.reduce((sum, item) => sum + item.real, 0)
    };

    return {
      comparativo,
      totais,
      diferencaTotal: totais.real - totais.planejado,
      percentualDiferencaTotal: totais.planejado > 0 ? ((totais.real - totais.planejado) / totais.planejado) * 100 : 0
    };
  }

  // ============= INTEGRAÇÃO DE EQUIPAMENTOS =============

  /**
   * Detecta novas transações de equipamentos que ainda não foram processadas
   */
  detectNewEquipmentTransactions(): {
    transacao: any;
    item: ItemFinanceiro;
    valor: number;
    data: string;
    observacoes?: string;
  }[] {
    const transacoes = RecurringBlueprintEngine.loadTransactions();
    const itensFinanceiros = storage.load(this.STORAGE_KEYS.FINANCIAL_ITEMS, []);
    const equipamentosExistentes = this.getEquipmentFromPricing();
    const processedIds = this.getProcessedEquipmentTransactionIds();

    console.log('🔧 [DetectEquipment] Total transações:', transacoes.length);
    console.log('🔧 [DetectEquipment] Processed IDs:', processedIds);

    // Encontrar item "Equipamentos" no grupo "Investimento"
    const itemEquipamentos = itensFinanceiros.find((item: ItemFinanceiro) => 
      item.nome === 'Equipamentos' && item.grupo_principal === 'Investimento'
    );

    if (!itemEquipamentos) {
      console.log('🔧 [DetectEquipment] Item "Equipamentos" não encontrado');
      return [];
    }

    console.log('🔧 [DetectEquipment] Item Equipamentos ID:', itemEquipamentos.id);

    // Filtrar transações de equipamentos não processadas
    const transacoesEquipamentos = transacoes.filter((t: any) => {
      // Deve ser do item "Equipamentos"
      if (t.itemId !== itemEquipamentos.id) return false;
      
      // Não deve estar processada
      if (processedIds.includes(t.id)) return false;
      
      // Não deve já existir equipamento com mesmo valor e data
      const jaExiste = equipamentosExistentes.some(eq => 
        Math.abs(eq.valorPago - t.valor) < 0.01 && 
        eq.dataCompra === t.dataVencimento
      );
      
      return !jaExiste;
    });

    console.log('🔧 [DetectEquipment] Transações de equipamentos encontradas:', transacoesEquipamentos.length);

    return transacoesEquipamentos.map((transacao: any) => ({
      transacao,
      item: itemEquipamentos,
      valor: transacao.valor,
      data: transacao.dataVencimento,
      observacoes: transacao.observacoes || ''
    }));
  }

  /**
   * Busca equipamentos da precificação
   */
  getEquipmentFromPricing(): Array<{
    id: string;
    nome: string;
    valorPago: number;
    dataCompra: string;
    vidaUtil: number;
    transacaoId?: string;
  }> {
    const dados = storage.load(this.STORAGE_KEYS.PRICING_COSTS, {});
    return (dados as any).equipamentos || [];
  }

  /**
   * Salva equipamentos na precificação
   */
  saveEquipmentToPricing(equipamentos: any[]): void {
    const dados = storage.load(this.STORAGE_KEYS.PRICING_COSTS, {});
    const dadosAtualizados = { ...dados, equipamentos };
    storage.save(this.STORAGE_KEYS.PRICING_COSTS, dadosAtualizados);
  }

  /**
   * Obtém IDs de transações de equipamentos já processadas
   */
  private getProcessedEquipmentTransactionIds(): string[] {
    const processedIds = JSON.parse(localStorage.getItem('lunari_processed_equipment_transactions') || '[]');
    return processedIds;
  }

  /**
   * Marca transação de equipamento como processada
   */
  private markEquipmentTransactionAsProcessed(transacaoId: string): void {
    const processedIds = this.getProcessedEquipmentTransactionIds();
    if (!processedIds.includes(transacaoId)) {
      processedIds.push(transacaoId);
      localStorage.setItem('lunari_processed_equipment_transactions', JSON.stringify(processedIds));
    }
  }

  /**
   * Garante que o item "Equipamentos" existe no sistema financeiro
   */
  private ensureEquipamentosItemExists(): void {
    const itensFinanceiros = storage.load(this.STORAGE_KEYS.FINANCIAL_ITEMS, []);
    
    const itemEquipamentos = itensFinanceiros.find((item: ItemFinanceiro) => 
      item.nome === 'Equipamentos' && item.grupo_principal === 'Investimento'
    );

    if (!itemEquipamentos) {
      console.log('🔧 [CreateEquipment] Criando item "Equipamentos" automaticamente');
      
      const novoItem: ItemFinanceiro = {
        id: '9', // ID fixo para compatibilidade
        nome: 'Equipamentos',
        grupo_principal: 'Investimento',
        userId: 'user1',
        ativo: true,
        criadoEm: getCurrentDateString()
      };

      itensFinanceiros.push(novoItem);
      storage.save(this.STORAGE_KEYS.FINANCIAL_ITEMS, itensFinanceiros);
    }
  }

  /**
   * Cria equipamento na precificação baseado na transação financeira
   */
  createEquipmentFromTransaction(transacaoId: string, dadosEquipamento: {
    nome: string;
    vidaUtil: number;
  }): {
    success: boolean;
    equipamentoId?: string;
    error?: string;
  } {
    try {
      // Garantir que o item "Equipamentos" existe
      this.ensureEquipamentosItemExists();
      
      const transacoes = RecurringBlueprintEngine.loadTransactions();
      const transacao = transacoes.find((t: any) => t.id === transacaoId);

      console.log('🔧 [CreateEquipment] Procurando transação ID:', transacaoId);
      console.log('🔧 [CreateEquipment] Total transações disponíveis:', transacoes.length);
      console.log('🔧 [CreateEquipment] Transação encontrada:', !!transacao);

      if (!transacao) {
        return { success: false, error: 'Transação não encontrada' };
      }

      const equipamentosExistentes = this.getEquipmentFromPricing();
      
      // Verificar se já existe equipamento para esta transação
      const jaExiste = equipamentosExistentes.some(eq => eq.transacaoId === transacaoId);
      if (jaExiste) {
        return { success: false, error: 'Equipamento já criado para esta transação' };
      }

      const novoEquipamento = {
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
        nome: dadosEquipamento.nome,
        valorPago: transacao.valor,
        dataCompra: transacao.dataVencimento,
        vidaUtil: dadosEquipamento.vidaUtil,
        transacaoId: transacaoId
      };

      const equipamentosAtualizados = [...equipamentosExistentes, novoEquipamento];
      this.saveEquipmentToPricing(equipamentosAtualizados);
      
      // Marcar transação como processada
      this.markEquipmentTransactionAsProcessed(transacaoId);

      console.log('🔧 Equipamento criado na precificação:', novoEquipamento);
      
      return { 
        success: true, 
        equipamentoId: novoEquipamento.id 
      };

    } catch (error) {
      console.error('Erro ao criar equipamento na precificação:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Erro desconhecido' 
      };
    }
  }

  /**
   * Gera preview da sincronização reversa (Equipamentos da Precificação → Finanças)
   */
  generateEquipmentReverseSyncPreview(): {
    equipamento: any;
    acao: 'adicionar';
    valorTotal: number;
    criarRecorrencia: boolean;
  }[] {
    const equipamentos = this.getEquipmentFromPricing();
    const transacoes = storage.load(this.STORAGE_KEYS.TRANSACTIONS, []);
    const itensFinanceiros = storage.load(this.STORAGE_KEYS.FINANCIAL_ITEMS, []);

    // Encontrar item "Equipamentos"
    const itemEquipamentos = itensFinanceiros.find((item: ItemFinanceiro) => 
      item.nome === 'Equipamentos' && item.grupo_principal === 'Investimento'
    );

    if (!itemEquipamentos) return [];

    return equipamentos
      .filter(equipamento => !equipamento.transacaoId) // Apenas equipamentos sem origem financeira
      .map(equipamento => {
        // Verificar se já existe transação para este equipamento
        const jaExisteTransacao = transacoes.some((t: any) => 
          t.itemId === itemEquipamentos.id &&
          Math.abs(t.valor - equipamento.valorPago) < 0.01 &&
          t.dataVencimento === equipamento.dataCompra
        );

        return {
          equipamento,
          acao: 'adicionar' as const,
          valorTotal: equipamento.valorPago,
          criarRecorrencia: false,
          jaExiste: jaExisteTransacao
        };
      })
      .filter(item => !item.jaExiste);
  }

  // ============= UTILITÁRIOS =============

  /**
   * Verifica se há integração configurada
   */
  hasIntegrationSetup(): boolean {
    const custosEstudio = this.getCustosEstudioFromPricing();
    return custosEstudio.some(custo => custo.origem === 'financeiro' && custo.itemFinanceiroId);
  }

  /**
   * Limpa todas as integrações
   */
  clearAllIntegrations(): void {
    const custosEstudio = this.getCustosEstudioFromPricing();
    const custosLimpos = custosEstudio.filter(custo => custo.origem !== 'financeiro');
    this.saveCustosEstudioToPricing(custosLimpos);
  }
}

// Singleton
export const pricingFinancialIntegrationService = new PricingFinancialIntegrationService();