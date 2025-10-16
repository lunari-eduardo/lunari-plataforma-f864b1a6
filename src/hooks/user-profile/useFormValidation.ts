import { useMemo } from 'react';
import { validateEmail, validateCpfCnpj } from '@/utils/userUtils';
import { UserProfile } from '@/services/ProfileService';

export interface ValidationResult {
  isValid: boolean;
  errors: Record<string, string>;
}

export function useFormValidation(formData: Partial<UserProfile>) {
  const validation = useMemo<ValidationResult>(() => {
    const errors: Record<string, string> = {};

    // Validar nome completo (obrigatório)
    if (!formData.nome || formData.nome.trim().length === 0) {
      errors.nome = 'Nome completo é obrigatório';
    }

    // Validar email (opcional, mas se preenchido, deve ser válido)
    if (formData.email && formData.email.trim().length > 0 && !validateEmail(formData.email)) {
      errors.email = 'E-mail inválido';
    }

    // Validar CPF/CNPJ (opcional, mas se preenchido, deve ser válido)
    if (formData.cpf_cnpj && formData.cpf_cnpj.trim().length > 0 && !validateCpfCnpj(formData.cpf_cnpj)) {
      errors.cpf_cnpj = 'CPF/CNPJ inválido';
    }

    return {
      errors,
      isValid: Object.keys(errors).length === 0 && !!formData.nome
    };
  }, [formData.nome, formData.email, formData.cpf_cnpj]);

  return validation;
}
