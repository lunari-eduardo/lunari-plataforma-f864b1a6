import { TransacaoComItem, StatusTransacao } from '@/types/financas';
import { DREMode, DREPeriod, DREConfig, DREResult, DRELine, DREGroupKey, DREMovement } from '@/types/dre';
import { RecurringBlueprintEngine } from './RecurringBlueprintEngine';

export class DreEngine {
  
  /**
   * Constrói movimentos base a partir dos dados financeiros e workflow
   */
  static buildBaseMovements(args: {
    transacoesFinanceiras: TransacaoComItem[];
    workflowItems: any[];
    mode: DREMode;
    period: DREPeriod;
  }): DREMovement[] {
    const { transacoesFinanceiras, workflowItems, mode, period } = args;
    const movements: DREMovement[] = [];
    const processedIds = new Set<string>(); // Para evitar duplicações

    // Filtrar transações por período
    const filteredTransacoes = this.filterTransactionsByPeriod(transacoesFinanceiras, period);
    
    // Processar transações financeiras
    filteredTransacoes.forEach(transacao => {
      const key = `fin_${transacao.id}`;
      if (processedIds.has(key)) return;
      processedIds.add(key);

      // Determinar se deve incluir baseado no modo
      const shouldInclude = mode === 'caixa' 
        ? transacao.status === 'Pago'
        : ['Pago', 'Faturado', 'Agendado'].includes(transacao.status);

      if (!shouldInclude) return;

      const isReceita = transacao.item.grupo_principal === 'Receita Não Operacional';
      
      movements.push({
        tipo: isReceita ? 'entrada' : 'saida',
        valor: transacao.valor,
        origem: 'financeiro',
        categoria: transacao.item.grupo_principal,
        item: transacao.item,
        dataCompetencia: transacao.data_vencimento,
        dataCaixa: transacao.status === 'Pago' ? transacao.data_vencimento : undefined,
        status: transacao.status,
        meta: {
          transacaoId: transacao.id,
          itemId: transacao.item_id,
          itemNome: transacao.item.nome
        }
      });
    });

    // Processar itens do workflow (receitas operacionais)
    const filteredWorkflow = this.filterWorkflowByPeriod(workflowItems, period);
    
    filteredWorkflow.forEach(item => {
      if (!item.valorPago || item.valorPago <= 0) return;

      const key = `wf_${item.id}`;
      if (processedIds.has(key)) return;
      processedIds.add(key);

      // Para workflow, usar sempre a data de pagamento se disponível
      const dataCompetencia = item.dataVencimento || item.data;
      const dataCaixa = item.dataPagamento || (item.status === 'pago' ? item.data : undefined);

      // Determinar se deve incluir baseado no modo
      const shouldInclude = mode === 'caixa' 
        ? !!dataCaixa
        : !!dataCompetencia;

      if (!shouldInclude) return;

      movements.push({
        tipo: 'entrada',
        valor: parseFloat(item.valorPago.toString()),
        origem: 'workflow',
        categoria: 'receita_operacional',
        meioPagamento: item.meioPagamento || 'não_informado',
        dataCompetencia,
        dataCaixa,
        meta: {
          sessionId: item.id,
          clienteNome: item.clienteNome || 'Cliente não identificado',
          projetoNome: item.nome || 'Projeto sem nome'
        }
      });
    });

    return movements;
  }

  /**
   * Mapeia movimentos para grupos DRE
   */
  static mapMovementsToDRE(movements: DREMovement[], config: DREConfig): Record<DREGroupKey, number> {
    const grupos: Record<DREGroupKey, number> = {
      receita_bruta: 0,
      deducoes: 0,
      receita_liquida: 0,
      cogs: 0,
      lucro_bruto: 0,
      opex_pessoal: 0,
      opex_adm: 0,
      opex_marketing: 0,
      opex_vendas: 0,
      opex_outros: 0,
      ebitda: 0,
      depreciacao: 0,
      resultado_operacional: 0,
      resultado_financeiro: 0,
      resultado_antes_impostos: 0,
      ir_csll: 0,
      lucro_liquido: 0
    };

    let receitaBrutaOperacional = 0;

    // Processar movimentos
    movements.forEach(movement => {
      if (movement.tipo === 'entrada') {
        if (movement.origem === 'workflow') {
          // Receitas operacionais
          grupos.receita_bruta += movement.valor;
          receitaBrutaOperacional += movement.valor;
        } else {
          // Receitas não operacionais
          grupos.receita_bruta += movement.valor;
        }
      } else {
        // Saídas - mapear para grupos corretos
        const grupo = this.mapItemToGroup(movement, config);
        grupos[grupo] += movement.valor;
      }
    });

    // Calcular deduções (impostos + taxas)
    const taxasGateway = this.calculateGatewayFees(movements, config);
    const impostosSobreReceita = this.calculateTaxes(receitaBrutaOperacional, config);
    
    grupos.deducoes = taxasGateway + impostosSobreReceita;

    return grupos;
  }

  /**
   * Computa o DRE completo
   */
  static computeDRE(
    period: DREPeriod,
    mode: DREMode,
    config: DREConfig,
    deps: { transacoesFinanceiras: TransacaoComItem[]; workflowItems: any[] }
  ): DREResult {
    const movements = this.buildBaseMovements({ ...deps, mode, period });
    const grupos = this.mapMovementsToDRE(movements, config);

    // Calcular linhas hierárquicas
    const receitaLiquida = grupos.receita_bruta - grupos.deducoes;
    const lucroBruto = receitaLiquida - grupos.cogs;
    const totalOpex = grupos.opex_pessoal + grupos.opex_adm + grupos.opex_marketing + grupos.opex_vendas + grupos.opex_outros;
    const ebitda = lucroBruto - totalOpex;
    const resultadoOperacional = ebitda - grupos.depreciacao;
    const resultadoAntesImpostos = resultadoOperacional + grupos.resultado_financeiro;
    const lucroLiquido = resultadoAntesImpostos - grupos.ir_csll;

    // Construir linhas DRE
    const lines: DRELine[] = [
      { key: 'receita_bruta', label: 'Receita Bruta', value: grupos.receita_bruta, percentageOfNet: (grupos.receita_bruta / receitaLiquida) * 100 },
      { key: 'deducoes', label: '(-) Deduções e Impostos', value: grupos.deducoes, percentageOfNet: (grupos.deducoes / receitaLiquida) * 100 },
      { key: 'receita_liquida', label: 'Receita Líquida', value: receitaLiquida, percentageOfNet: 100 },
      { key: 'cogs', label: '(-) Custo dos Serviços Vendidos', value: grupos.cogs, percentageOfNet: (grupos.cogs / receitaLiquida) * 100 },
      { key: 'lucro_bruto', label: 'Lucro Bruto', value: lucroBruto, percentageOfNet: (lucroBruto / receitaLiquida) * 100 },
      {
        key: 'opex_pessoal',
        label: '(-) Despesas Operacionais',
        value: totalOpex,
        percentageOfNet: (totalOpex / receitaLiquida) * 100,
        children: [
          { key: 'opex_pessoal', label: 'Pessoal', value: grupos.opex_pessoal, percentageOfNet: (grupos.opex_pessoal / receitaLiquida) * 100 },
          { key: 'opex_adm', label: 'Administrativas', value: grupos.opex_adm, percentageOfNet: (grupos.opex_adm / receitaLiquida) * 100 },
          { key: 'opex_marketing', label: 'Marketing', value: grupos.opex_marketing, percentageOfNet: (grupos.opex_marketing / receitaLiquida) * 100 },
          { key: 'opex_vendas', label: 'Vendas', value: grupos.opex_vendas, percentageOfNet: (grupos.opex_vendas / receitaLiquida) * 100 },
          { key: 'opex_outros', label: 'Outras', value: grupos.opex_outros, percentageOfNet: (grupos.opex_outros / receitaLiquida) * 100 }
        ]
      },
      { key: 'ebitda', label: 'EBITDA', value: ebitda, percentageOfNet: (ebitda / receitaLiquida) * 100 },
      { key: 'depreciacao', label: '(-) Depreciação/Amortização', value: grupos.depreciacao, percentageOfNet: (grupos.depreciacao / receitaLiquida) * 100 },
      { key: 'resultado_operacional', label: 'Resultado Operacional', value: resultadoOperacional, percentageOfNet: (resultadoOperacional / receitaLiquida) * 100 },
      { key: 'resultado_financeiro', label: '(+/-) Resultado Financeiro', value: grupos.resultado_financeiro, percentageOfNet: (grupos.resultado_financeiro / receitaLiquida) * 100 },
      { key: 'resultado_antes_impostos', label: 'Resultado antes IR/CSLL', value: resultadoAntesImpostos, percentageOfNet: (resultadoAntesImpostos / receitaLiquida) * 100 },
      { key: 'ir_csll', label: '(-) IR/CSLL', value: grupos.ir_csll, percentageOfNet: (grupos.ir_csll / receitaLiquida) * 100 },
      { key: 'lucro_liquido', label: 'Lucro Líquido', value: lucroLiquido, percentageOfNet: (lucroLiquido / receitaLiquida) * 100 }
    ];

    const kpis = {
      receitaLiquida,
      lucroBruto,
      ebitda,
      lucroLiquido
    };

    return {
      period,
      mode,
      lines,
      kpis
    };
  }

  // === Funções auxiliares ===

  private static filterTransactionsByPeriod(transactions: TransacaoComItem[], period: DREPeriod): TransacaoComItem[] {
    return transactions.filter(t => {
      const [year, month] = t.data_vencimento.split('-').map(Number);
      
      if (period.type === 'annual') {
        return year === period.year;
      } else {
        return year === period.year && month === period.month;
      }
    });
  }

  private static filterWorkflowByPeriod(workflowItems: any[], period: DREPeriod): any[] {
    return workflowItems.filter(item => {
      const date = item.dataVencimento || item.data;
      if (!date) return false;
      
      const [year, month] = date.split('-').map(Number);
      
      if (period.type === 'annual') {
        return year === period.year;
      } else {
        return year === period.year && month === period.month;
      }
    });
  }

  private static mapItemToGroup(movement: DREMovement, config: DREConfig): DREGroupKey {
    if (!movement.item) return 'opex_outros';

    const itemNome = movement.item.nome?.toLowerCase() || '';
    const categoria = movement.categoria?.toLowerCase() || '';

    // Verificar mapeamento específico primeiro
    for (const [termo, grupo] of Object.entries(config.mapeamentoItens)) {
      if (itemNome.includes(termo.toLowerCase()) || categoria.includes(termo.toLowerCase())) {
        return grupo as DREGroupKey;
      }
    }

    // Mapeamento padrão por grupo principal
    switch (movement.categoria) {
      case 'Despesa Variável':
        // Heurísticas para despesa variável
        if (itemNome.includes('terceiro') || itemNome.includes('laboratorio') || itemNome.includes('album')) {
          return 'cogs';
        }
        if (itemNome.includes('marketing') || itemNome.includes('ads') || itemNome.includes('publicidade')) {
          return 'opex_marketing';
        }
        if (itemNome.includes('combustivel') || itemNome.includes('deslocamento') || itemNome.includes('vendas')) {
          return 'opex_vendas';
        }
        return 'cogs'; // Default para despesa variável

      case 'Despesa Fixa':
        // Heurísticas para despesa fixa
        if (itemNome.includes('salario') || itemNome.includes('prolabore') || itemNome.includes('pessoal')) {
          return 'opex_pessoal';
        }
        return 'opex_adm'; // Default para despesa fixa

      case 'Investimento':
        return 'depreciacao';

      default:
        return 'opex_outros';
    }
  }

  private static calculateGatewayFees(movements: DREMovement[], config: DREConfig): number {
    let totalFees = 0;

    movements.forEach(movement => {
      if (movement.tipo === 'entrada' && movement.meioPagamento) {
        const fee = config.gatewayFees[movement.meioPagamento] || 0;
        totalFees += movement.valor * (fee / 100);
      }
    });

    return totalFees;
  }

  private static calculateTaxes(receitaBruta: number, config: DREConfig): number {
    let totalTaxes = 0;

    // Impostos sobre receita
    totalTaxes += receitaBruta * (config.aliquotaTributariaSobreReceita / 100);

    // ISS se aplicável
    if (config.incluirIssRetido) {
      totalTaxes += receitaBruta * (config.issSobreReceita / 100);
    }

    return totalTaxes;
  }

  /**
   * Calcula comparativo com período anterior
   */
  static computeComparative(
    currentResult: DREResult,
    config: DREConfig,
    deps: { transacoesFinanceiras: TransacaoComItem[]; workflowItems: any[] }
  ): DREResult {
    // Calcular período anterior
    const previousPeriod: DREPeriod = currentResult.period.type === 'monthly'
      ? {
          type: 'monthly',
          month: currentResult.period.month === 1 ? 12 : currentResult.period.month! - 1,
          year: currentResult.period.month === 1 ? currentResult.period.year - 1 : currentResult.period.year
        }
      : {
          type: 'annual',
          year: currentResult.period.year - 1
        };

    const previousResult = this.computeDRE(previousPeriod, currentResult.mode, config, deps);

    // Calcular deltas percentuais
    const calculateDelta = (current: number, previous: number): number => {
      if (previous === 0) return current > 0 ? 100 : 0;
      return ((current - previous) / previous) * 100;
    };

    const deltaPercentual = {
      receitaLiquida: calculateDelta(currentResult.kpis.receitaLiquida, previousResult.kpis.receitaLiquida),
      lucroBruto: calculateDelta(currentResult.kpis.lucroBruto, previousResult.kpis.lucroBruto),
      ebitda: calculateDelta(currentResult.kpis.ebitda, previousResult.kpis.ebitda),
      lucroLiquido: calculateDelta(currentResult.kpis.lucroLiquido, previousResult.kpis.lucroLiquido)
    };

    return {
      ...currentResult,
      previousPeriod: {
        kpis: previousResult.kpis,
        deltaPercentual
      }
    };
  }
}