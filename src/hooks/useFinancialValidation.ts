import { useCallback } from 'react';
import { ItemFinanceiro } from '@/types/financas';
import { useToast } from '@/hooks/use-toast';
import { validateItemName } from '@/utils/financialItemsUtils';

export function useFinancialValidation(itensFinanceiros: ItemFinanceiro[]) {
  const { toast } = useToast();

  const validateAndShowError = useCallback((name: string, excludeId?: string) => {
    const validation = validateItemName(name, itensFinanceiros, excludeId);
    if (!validation.valid) {
      toast({
        title: "Erro",
        description: validation.error,
        variant: "destructive"
      });
      return false;
    }
    return true;
  }, [itensFinanceiros, toast]);

  const showSuccessToast = useCallback((message: string) => {
    toast({
      title: "Sucesso",
      description: message
    });
  }, [toast]);

  const showErrorToast = useCallback((message: string) => {
    toast({
      title: "Erro",
      description: message,
      variant: "destructive"
    });
  }, [toast]);

  return { 
    validateAndShowError, 
    showSuccessToast, 
    showErrorToast 
  };
}