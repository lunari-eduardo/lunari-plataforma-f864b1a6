import { ItemFinanceiro, GrupoPrincipal } from '@/types/financas';
import { TOAST_MESSAGES } from '@/constants/financialConstants';

export const groupItemsByCategory = (
  items: ItemFinanceiro[], 
  groups: GrupoPrincipal[]
): Record<GrupoPrincipal, ItemFinanceiro[]> => {
  return groups.reduce((acc, group) => {
    acc[group] = items.filter(item => item.grupo_principal === group && item.ativo);
    return acc;
  }, {} as Record<GrupoPrincipal, ItemFinanceiro[]>);
};

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

export const validateItemName = (
  name: string, 
  existingItems: ItemFinanceiro[], 
  excludeId?: string
): ValidationResult => {
  const trimmedName = name.trim();
  
  if (!trimmedName) {
    return { valid: false, error: TOAST_MESSAGES.ERROR_EMPTY_NAME };
  }
  
  const duplicate = existingItems.find(item => 
    item.id !== excludeId && 
    item.nome.toLowerCase() === trimmedName.toLowerCase()
  );
  
  if (duplicate) {
    return { valid: false, error: TOAST_MESSAGES.ERROR_DUPLICATE_NAME };
  }
  
  return { valid: true };
};