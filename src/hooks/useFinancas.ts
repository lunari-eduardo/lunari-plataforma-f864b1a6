/**
 * HOOK DESCONTINUADO - SUBSTITUÍDO PELA NOVA ARQUITETURA DE BLUEPRINTS
 * 
 * Este hook foi completamente substituído pelo sistema de Blueprints implementado
 * no useNovoFinancas.ts e RecurringBlueprintEngine.ts
 * 
 * A lógica anterior de "pai-filho" causava duplicações massivas e foi descartada.
 * A nova arquitetura é baseada em "regras" (blueprints) e "instâncias" (transações).
 */

import { useNovoFinancas } from './useNovoFinancas';

// Re-exportar a nova implementação para compatibilidade
export function useFinancas() {
  console.warn('useFinancas foi migrado para a nova arquitetura de Blueprints');
  return useNovoFinancas();
}

// Manter a função antiga como backup (não deve ser usada)
export function useFinancas_OLD_DEPRECATED() {
  throw new Error('Esta implementação foi descontinuada devido a bugs críticos de duplicação. Use useNovoFinancas() com a nova arquitetura de Blueprints.');
}