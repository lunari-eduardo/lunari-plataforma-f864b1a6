/**
 * FASE 5: Session Values Validation Utility
 * 
 * Validates the integrity of session financial values
 * Helps detect data inconsistencies between valor_base_pacote and valor_total
 */

export interface SessionValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  calculatedTotal: number;
  savedTotal: number;
}

/**
 * Validate session financial values integrity
 */
export function validateSessionValues(session: any): SessionValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  const valorBase = Number(session.valor_base_pacote) || 0;
  const valorFotos = Number(session.valor_total_foto_extra) || 0;
  const valorAdicional = Number(session.valor_adicional) || 0;
  const desconto = Number(session.desconto) || 0;
  
  // Calcular produtos manuais
  const produtosList = Array.isArray(session.produtos_incluidos) 
    ? session.produtos_incluidos : [];
  const valorProdutos = produtosList.reduce((acc: number, p: any) => {
    if (p.tipo === 'manual') {
      return acc + ((Number(p.valorUnitario) || 0) * (Number(p.quantidade) || 0));
    }
    return acc;
  }, 0);
  
  const totalCalculado = valorBase + valorFotos + valorProdutos + valorAdicional - desconto;
  const totalSalvo = Number(session.valor_total) || 0;
  
  // Validação 1: Sessão tem pacote mas valor_base_pacote é 0
  if (session.pacote && valorBase === 0) {
    // Check if we can get from regras_congeladas
    const regrasCongeladas = session.regras_congeladas as any;
    if (regrasCongeladas?.valorBase && Number(regrasCongeladas.valorBase) > 0) {
      warnings.push('valor_base_pacote é 0, mas existe em regras_congeladas');
    } else {
      warnings.push('Sessão tem pacote mas valor_base_pacote é 0');
    }
  }
  
  // Validação 2: Inconsistência entre valor_total calculado e salvo
  if (Math.abs(totalCalculado - totalSalvo) > 0.01) {
    errors.push(
      `valor_total inconsistente: salvo=R$ ${totalSalvo.toFixed(2)}, ` +
      `calculado=R$ ${totalCalculado.toFixed(2)}`
    );
  }
  
  // Validação 3: valor_total menor que valor_base_pacote (impossível)
  if (valorBase > 0 && totalSalvo < valorBase && Math.abs(totalSalvo - valorBase) > 0.01) {
    errors.push(
      `valor_total (R$ ${totalSalvo.toFixed(2)}) menor que ` +
      `valor_base_pacote (R$ ${valorBase.toFixed(2)})`
    );
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    calculatedTotal: totalCalculado,
    savedTotal: totalSalvo
  };
}

/**
 * Get validation badge color based on validation result
 */
export function getValidationBadgeColor(result: SessionValidationResult): string {
  if (!result.isValid) return 'destructive';
  if (result.warnings.length > 0) return 'warning';
  return 'success';
}

/**
 * Get validation status text
 */
export function getValidationStatusText(result: SessionValidationResult): string {
  if (!result.isValid) return 'Inconsistente';
  if (result.warnings.length > 0) return 'Avisos';
  return 'OK';
}
