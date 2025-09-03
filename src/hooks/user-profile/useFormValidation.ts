import { useMemo } from 'react';
import { validateEmail, validateCpfCnpj } from '@/utils/userUtils';
import { UserProfile } from '@/types/userProfile';

export interface ValidationResult {
  isValid: boolean;
  errors: Record<string, string>;
}

export function useFormValidation(formData: Partial<UserProfile>) {
  const validation = useMemo<ValidationResult>(() => {
    const errors: Record<string, string> = {};

    // Nome completo é obrigatório
    if (!formData.nomeCompleto?.trim()) {
      errors.nomeCompleto = 'Nome completo é obrigatório';
    }

    // E-mail deve ser válido se fornecido
    if (formData.emailPrincipal && !validateEmail(formData.emailPrincipal)) {
      errors.emailPrincipal = 'E-mail inválido';
    }

    // CPF/CNPJ deve ser válido se fornecido
    if (formData.cpfCnpj && !validateCpfCnpj(formData.cpfCnpj)) {
      errors.cpfCnpj = 'CPF/CNPJ inválido';
    }

    return {
      isValid: Object.keys(errors).length === 0,
      errors
    };
  }, [formData.nomeCompleto, formData.emailPrincipal, formData.cpfCnpj]);

  return validation;
}