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
   * Inteligente para parcelamentos: agrupa e considera valor total consolidado
   */
  detectNewEquipmentTransactions(): {
    transacao: any;
    valor: number;
    data: string;
    observacoes?: string;
    allTransactionIds: string[];
  }[] {
    // Garantir que o item "Equipamentos" existe antes de detectar
    this.ensureEquipamentosItemExists();
    
    const transacoes = RecurringBlueprintEngine.loadTransactions();
    const itensFinanceiros = storage.load(this.STORAGE_KEYS.FINANCIAL_ITEMS, []);
    const equipamentosExistentes = this.getEquipmentFromPricing();
    const processedIds = this.getProcessedEquipmentTransactionIds();

    console.log('🔧 [DetectEquipment] Total transações:', transacoes.length);
    console.log('🔧 [DetectEquipment] Equipamentos existentes:', equipamentosExistentes.length);
    console.log('🔧 [DetectEquipment] Processed IDs:', processedIds);

    // Encontrar item "Equipamentos" no grupo "Investimento"
    let itemEquipamentos = itensFinanceiros.find((item: ItemFinanceiro) => 
      item.nome === 'Equipamentos' && item.grupo_principal === 'Investimento'
    );

    if (!itemEquipamentos) {
      console.log('🔧 [DetectEquipment] Item "Equipamentos" não encontrado, criando automaticamente...');
      this.ensureEquipamentosItemExists();
      
      // Recarregar itens após criação
      const itensAtualizados = storage.load(this.STORAGE_KEYS.FINANCIAL_ITEMS, []);
      itemEquipamentos = itensAtualizados.find((item: ItemFinanceiro) => 
        item.nome === 'Equipamentos' && item.grupo_principal === 'Investimento'
      );
      
      if (!itemEquipamentos) {
        console.error('🔧 [DetectEquipment] Falha ao criar/encontrar item "Equipamentos"');
        return [];
      }
    }

    console.log('🔧 [DetectEquipment] Item Equipamentos encontrado - ID:', itemEquipamentos.id, 'Nome:', itemEquipamentos.nome);

    // Filtrar transações de equipamentos não processadas
    const transacoesEquipamentos = transacoes.filter((t: any) => {
      const isEquipamento = t.itemId === itemEquipamentos.id;
      const isNotProcessed = !processedIds.includes(t.id);
      
      return isEquipamento && isNotProcessed;
    });

    console.log('🔧 [DetectEquipment] Transações de equipamentos candidatas:', transacoesEquipamentos.length);

    // INTELIGÊNCIA PARA PARCELAMENTOS: Agrupar por observações similares ou IDs relacionados
    const gruposEquipamentos = new Map<string, any[]>();
    
    transacoesEquipamentos.forEach(transacao => {
      const grupoKey = (transacao.observacoes && transacao.observacoes.trim()) || 
                      `single_${transacao.id}`;
      
      if (!gruposEquipamentos.has(grupoKey)) {
        gruposEquipamentos.set(grupoKey, []);
      }
      gruposEquipamentos.get(grupoKey)!.push(transacao);
    });

    console.log('🔧 [DetectEquipment] Grupos de equipamentos encontrados:', gruposEquipamentos.size);

    const candidatos: {
      transacao: any;
      valor: number;
      data: string;
      observacoes?: string;
      allTransactionIds: string[];
    }[] = [];

    // Processar cada grupo (consolidando parcelamentos)
    for (const [grupoKey, transacoesGrupo] of gruposEquipamentos) {
      // Consolidar dados do grupo
      const valorTotal = transacoesGrupo.reduce((sum, t) => sum + parseFloat(t.valor || 0), 0);
      const primeiraTransacao = transacoesGrupo.sort((a, b) => 
        new Date(a.dataVencimento).getTime() - new Date(b.dataVencimento).getTime()
      )[0];
      
      const observacoes = primeiraTransacao.observacoes?.trim();
      const nomeEquipamento = observacoes || `Equipamento R$ ${valorTotal.toFixed(2)}`;
      
      candidatos.push({
        transacao: primeiraTransacao,
        valor: valorTotal,
        data: primeiraTransacao.dataVencimento,
        observacoes: nomeEquipamento,
        allTransactionIds: transacoesGrupo.map(t => t.id)
      });
      
      console.log(`🔧 [DetectEquipment] Grupo processado: ${nomeEquipamento} - R$ ${valorTotal.toFixed(2)} (${transacoesGrupo.length} parcelas)`);
    }

    return candidatos;
  }

  /**
   * Marca transações de equipamentos como processadas para evitar re-notificação
   */
  markEquipmentTransactionsAsProcessed(transactionIds: string[]): void {
    const processedIds = this.getProcessedEquipmentTransactionIds();
    transactionIds.forEach(id => {
      if (!processedIds.includes(id)) {
        processedIds.push(id);
      }
    });
    localStorage.setItem('lunari_processed_equipment_transactions', JSON.stringify(processedIds));
    console.log('🔧 [MarkProcessed] Marcadas como processadas:', transactionIds.length, 'transações');
  }

  /**
   * Agrupa transações parceladas e retorna apenas uma por equipamento real
   */
  private groupInstallmentTransactions(transacoes: any[], equipamentosExistentes: any[]): any[] {
    // Separar transações únicas e parceladas (compatível com múltiplos formatos)
    const transacoesUnicas: any[] = [];
    const gruposParcelados = new Map<string, any[]>();

    const getGrupoId = (t: any): string | null => {
      if (t.lançamentoPaiId) return t.lançamentoPaiId;
      if (t.parentId) return t.parentId;
      if (typeof t.id === 'string') {
        const match = t.id.match(/^(.*)_([0-9]+)$/); // ex: parcela_123456789_1 ou cartao_123_2
        if (match) return match[1];
      }
      return null;
    };

    const getNumeroParcela = (t: any): number => {
      if (t.numeroParcela) return Number(t.numeroParcela);
      if (t.parcelaInfo?.atual) return Number(t.parcelaInfo.atual);
      if (typeof t.id === 'string') {
        const match = t.id.match(/_([0-9]+)$/);
        if (match) return Number(match[1]);
      }
      return 0;
    };

    transacoes.forEach(t => {
      const grupoId = getGrupoId(t);
      const isParcelado = !!(t.lançamentoPaiId || t.parentId || t.parcelaInfo?.total > 1 || (typeof t.id === 'string' && /_([0-9]+)$/.test(t.id)));

      if (isParcelado && grupoId) {
        if (!gruposParcelados.has(grupoId)) {
          gruposParcelados.set(grupoId, []);
        }
        gruposParcelados.get(grupoId)!.push(t);
      } else {
        // Transação única
        transacoesUnicas.push(t);
      }
    });

    console.log('🔧 [GroupInstallments] Transações únicas:', transacoesUnicas.length);
    console.log('🔧 [GroupInstallments] Grupos parcelados:', gruposParcelados.size);

    const resultado: any[] = [];

    // Adicionar transações únicas diretamente se não já houver equipamento com mesmo valor/data
    transacoesUnicas.forEach(t => {
      const jaExiste = equipamentosExistentes.some(eq =>
        Math.abs(eq.valorPago - t.valor) < 0.01 &&
        eq.dataCompra === t.dataVencimento
      );
      if (!jaExiste) resultado.push(t);
    });

    // Processar grupos parcelados
    gruposParcelados.forEach((parcelas, grupoId) => {
      // Ordenar por número da parcela (fallback por data)
      parcelas.sort((a, b) => {
        const pa = getNumeroParcela(a);
        const pb = getNumeroParcela(b);
        if (pa !== pb) return pa - pb;
        return (a.dataVencimento || '').localeCompare(b.dataVencimento || '');
      });

      const primeiraParcela = parcelas[0];
      const valorTotal = parcelas.reduce((sum, p) => sum + (Number(p.valor) || 0), 0);

      console.log(`🔧 [GroupInstallments] Grupo ${grupoId}: ${parcelas.length} parcelas, valor total: R$ ${valorTotal.toFixed(2)}`);

      // Evitar duplicidade com equipamentos já salvos
      const jaExiste = equipamentosExistentes.some(eq =>
        Math.abs(eq.valorPago - valorTotal) < 0.01 &&
        eq.dataCompra === primeiraParcela.dataVencimento
      );

      if (!jaExiste) {
        const transacaoConsolidada = {
          ...primeiraParcela,
          valor: valorTotal, // usar valor integral da compra
          observacoes: primeiraParcela.observacoes || `Equipamento parcelado (${parcelas.length}x)`,
          grupoParcelado: {
            lançamentoPaiId: grupoId,
            totalParcelas: parcelas.length,
            parcelaIds: parcelas.map(p => p.id)
          }
        };
        resultado.push(transacaoConsolidada);
        console.log(`🔧 [GroupInstallments] Adicionado equipamento consolidado: ${transacaoConsolidada.observacoes}`);
      } else {
        console.log(`🔧 [GroupInstallments] Equipamento parcelado já existe para grupo ${grupoId}`);
      }
    });

    return resultado;
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
   * Inteligente para parcelamentos: marca todas as parcelas como processadas
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
      
      // Marcar transação principal como processada
      this.markEquipmentTransactionAsProcessed(transacaoId);

      // Se for equipamento parcelado, marcar todas as parcelas como processadas
      if ((transacao as any).grupoParcelado?.parcelaIds) {
        console.log('🔧 [CreateEquipment] Marcando parcelas como processadas:', (transacao as any).grupoParcelado.parcelaIds);
        (transacao as any).grupoParcelado.parcelaIds.forEach((parcelaId: string) => {
          this.markEquipmentTransactionAsProcessed(parcelaId);
        });
      }

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