/**
 * Pure calculation service for pricing logic
 * Handles all mathematical operations for pricing calculations
 */

import type { 
  FaixaPreco, 
  TabelaPrecos, 
  PricingCalculationInput, 
  PricingCalculationResult,
  RegrasPrecoFotoExtraCongeladas 
} from '@/types/pricing';

export class PricingCalculationService {
  /**
   * Calculate unit price based on quantity and pricing table
   */
  static calcularValorPorFoto(quantidade: number, tabela: TabelaPrecos): number {
    if (!tabela || !tabela.faixas || quantidade <= 0) {
      return 0;
    }

    // Sort ranges by min ascending to ensure correct order
    const faixasOrdenadas = [...tabela.faixas].sort((a, b) => a.min - b.min);

    for (const faixa of faixasOrdenadas) {
      if (quantidade >= faixa.min && (faixa.max === null || quantidade <= faixa.max)) {
        return faixa.valor;
      }
    }

    // If no specific range found, use the last range (highest value)
    return faixasOrdenadas[faixasOrdenadas.length - 1]?.valor || 0;
  }

  /**
   * Calculate total with frozen rules (main calculation engine)
   */
  static calcularComRegrasProprias(
    quantidade: number,
    regrasCongeladas: RegrasPrecoFotoExtraCongeladas
  ): number {
    if (quantidade <= 0) {
      return 0;
    }

    if (!regrasCongeladas) {
      console.error('❌ Frozen rules not provided');
      return 0;
    }

    switch (regrasCongeladas.modelo) {
      case 'fixo':
        const valorFixo = regrasCongeladas.valorFixo || 0;
        return quantidade * valorFixo;

      case 'global':
        if (!regrasCongeladas.tabelaGlobal) {
          console.error('❌ Global table not found in frozen rules');
          return 0;
        }
        
        const valorPorFotoGlobal = this.calcularValorPorFoto(quantidade, regrasCongeladas.tabelaGlobal);
        return quantidade * valorPorFotoGlobal;

      case 'categoria':
        if (!regrasCongeladas.tabelaCategoria) {
          console.error('❌ Category table not found in frozen rules');
          return 0;
        }
        
        const valorPorFotoCategoria = this.calcularValorPorFoto(quantidade, regrasCongeladas.tabelaCategoria);
        return quantidade * valorPorFotoCategoria;

      default:
        console.error('❌ Unknown pricing model:', regrasCongeladas.modelo);
        return 0;
    }
  }

  /**
   * Calculate detailed pricing result with breakdown
   */
  static calcularDetalhado(
    input: PricingCalculationInput,
    tabela?: TabelaPrecos,
    modelo?: 'fixo' | 'global' | 'categoria'
  ): PricingCalculationResult {
    const { quantidade, pacoteInfo } = input;

    if (quantidade <= 0) {
      return {
        valorTotal: 0,
        valorUnitario: 0,
        modelo: modelo || 'fixo'
      };
    }

    let valorUnitario = 0;
    let faixaUsada: FaixaPreco | undefined;

    switch (modelo) {
      case 'fixo':
        valorUnitario = pacoteInfo?.valorFotoExtra || 0;
        break;
        
      case 'global':
      case 'categoria':
        if (tabela) {
          valorUnitario = this.calcularValorPorFoto(quantidade, tabela);
          // Find which range was used
          const faixasOrdenadas = [...tabela.faixas].sort((a, b) => a.min - b.min);
          faixaUsada = faixasOrdenadas.find(faixa => 
            quantidade >= faixa.min && (faixa.max === null || quantidade <= faixa.max)
          );
        }
        break;
    }

    return {
      valorTotal: quantidade * valorUnitario,
      valorUnitario,
      modelo: modelo || 'fixo',
      breakdown: {
        faixaUsada,
        tabelaUsada: tabela?.nome
      }
    };
  }

  /**
   * Recalculate ranges after changes (maintains sequence integrity)
   */
  static recalcularFaixas(faixas: FaixaPreco[]): FaixaPreco[] {
    return faixas.map((faixa, index) => {
      if (index === 0) {
        return { ...faixa, min: 1 }; // First range always starts at 1
      } else {
        const faixaAnterior = faixas[index - 1];
        const novoMin = (faixaAnterior.max || faixaAnterior.min) + 1;
        return { ...faixa, min: novoMin };
      }
    });
  }

  /**
   * Create example table for demonstration
   */
  static criarTabelaExemplo(): TabelaPrecos {
    return {
      id: crypto.randomUUID(),
      nome: 'Tabela Progressiva Padrão',
      faixas: [
        { min: 1, max: 5, valor: 35 },
        { min: 6, max: 10, valor: 30 },
        { min: 11, max: 20, valor: 25 },
        { min: 21, max: null, valor: 20 }
      ]
    };
  }
}