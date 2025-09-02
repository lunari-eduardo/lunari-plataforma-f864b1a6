/**
 * Validation service for pricing system
 * Handles all validation logic for pricing tables and configurations
 */

import type { TabelaPrecos, ValidationResult, TabelaPrecosValidation, FaixaPreco } from '@/types/pricing';

export class PricingValidationService {
  /**
   * Validate pricing table structure and data
   */
  static validarTabelaPrecos(tabela: TabelaPrecos): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!tabela.nome || tabela.nome.trim() === '') {
      errors.push('Nome da tabela é obrigatório');
    }

    if (!tabela.faixas || tabela.faixas.length === 0) {
      errors.push('Pelo menos uma faixa de preços deve ser configurada');
      return { valid: false, errors, warnings };
    }

    // Validate each range
    const faixasOrdenadas = [...tabela.faixas].sort((a, b) => a.min - b.min);
    
    for (let i = 0; i < faixasOrdenadas.length; i++) {
      const faixa = faixasOrdenadas[i];
      const faixaNumber = i + 1;
      
      // Basic validations
      if (faixa.min < 0) {
        errors.push(`Faixa ${faixaNumber}: Valor mínimo não pode ser negativo`);
      }
      
      if (faixa.max !== null && faixa.max < faixa.min) {
        errors.push(`Faixa ${faixaNumber}: Valor máximo deve ser maior que o mínimo`);
      }
      
      if (faixa.valor < 0) {
        errors.push(`Faixa ${faixaNumber}: Valor por foto não pode ser negativo`);
      }

      if (faixa.valor === 0) {
        warnings.push(`Faixa ${faixaNumber}: Valor por foto é zero`);
      }
      
      // Check overlaps with next range
      if (i < faixasOrdenadas.length - 1) {
        const proximaFaixa = faixasOrdenadas[i + 1];
        if (faixa.max !== null && faixa.max >= proximaFaixa.min) {
          errors.push(`Faixas ${faixaNumber} e ${faixaNumber + 1}: Há sobreposição entre as faixas`);
        }
        
        // Check for gaps
        if (faixa.max !== null && faixa.max + 1 < proximaFaixa.min) {
          warnings.push(`Entre faixas ${faixaNumber} e ${faixaNumber + 1}: Há uma lacuna na cobertura`);
        }
      }
    }

    // Check if first range starts at 1
    if (faixasOrdenadas[0] && faixasOrdenadas[0].min !== 1) {
      warnings.push('Primeira faixa deveria começar em 1');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validate and fix pricing table
   */
  static validarECorrigirTabela(tabela: TabelaPrecos): TabelaPrecosValidation {
    const validation = this.validarTabelaPrecos(tabela);
    
    if (!validation.valid) {
      return { ...validation, tabela };
    }

    // Apply automatic corrections for warnings
    let tabelaCorrigida = { ...tabela };
    
    if (validation.warnings && validation.warnings.length > 0) {
      // Auto-fix: ensure first range starts at 1
      const faixasOrdenadas = [...tabela.faixas].sort((a, b) => a.min - b.min);
      if (faixasOrdenadas[0] && faixasOrdenadas[0].min !== 1) {
        faixasOrdenadas[0] = { ...faixasOrdenadas[0], min: 1 };
        tabelaCorrigida = { ...tabela, faixas: faixasOrdenadas };
      }
    }

    return {
      valid: true,
      errors: [],
      warnings: validation.warnings,
      tabela: tabelaCorrigida
    };
  }

  /**
   * Validate pricing configuration
   */
  static validarConfiguracao(modelo: 'fixo' | 'global' | 'categoria'): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!modelo || !['fixo', 'global', 'categoria'].includes(modelo)) {
      errors.push('Modelo de precificação deve ser: fixo, global ou categoria');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validate range structure
   */
  static validarFaixa(faixa: FaixaPreco): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (faixa.min < 1) {
      errors.push('Valor mínimo deve ser pelo menos 1');
    }

    if (faixa.max !== null && faixa.max <= faixa.min) {
      errors.push('Valor máximo deve ser maior que o mínimo');
    }

    if (faixa.valor < 0) {
      errors.push('Valor por foto não pode ser negativo');
    }

    if (faixa.valor === 0) {
      warnings.push('Valor por foto é zero');
    }

    if (faixa.valor > 1000) {
      warnings.push('Valor por foto parece muito alto (> R$ 1000)');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Check if ranges cover all possible quantities without gaps
   */
  static verificarCobertura(faixas: FaixaPreco[]): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (faixas.length === 0) {
      errors.push('Nenhuma faixa configurada');
      return { valid: false, errors, warnings };
    }

    const faixasOrdenadas = [...faixas].sort((a, b) => a.min - b.min);

    // Check if starts from 1
    if (faixasOrdenadas[0].min !== 1) {
      warnings.push('Cobertura não inicia em 1');
    }

    // Check for gaps
    for (let i = 0; i < faixasOrdenadas.length - 1; i++) {
      const faixaAtual = faixasOrdenadas[i];
      const proximaFaixa = faixasOrdenadas[i + 1];
      
      if (faixaAtual.max !== null && faixaAtual.max + 1 < proximaFaixa.min) {
        warnings.push(`Lacuna entre faixas: ${faixaAtual.max + 1} a ${proximaFaixa.min - 1}`);
      }
    }

    // Check if last range has no upper limit
    const ultimaFaixa = faixasOrdenadas[faixasOrdenadas.length - 1];
    if (ultimaFaixa.max !== null) {
      warnings.push('Última faixa deveria ter valor máximo infinito (null)');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }
}