import { useMemo } from 'react';

interface ValidationErrors {
  nome?: string;
  telefone?: string;
  email?: string;
}

interface ClientFormData {
  nome: string;
  telefone: string;
  email: string;
}

export function useClientValidation(formData: ClientFormData) {
  const errors = useMemo((): ValidationErrors => {
    const validationErrors: ValidationErrors = {};

    // Nome é obrigatório
    if (!formData.nome?.trim()) {
      validationErrors.nome = 'Nome é obrigatório';
    }

    // Telefone é obrigatório
    if (!formData.telefone?.trim()) {
      validationErrors.telefone = 'Telefone é obrigatório';
    } else {
      // Validar formato básico do telefone (pelo menos 10 dígitos)
      const phoneDigits = formData.telefone.replace(/\D/g, '');
      if (phoneDigits.length < 10) {
        validationErrors.telefone = 'Telefone deve ter pelo menos 10 dígitos';
      }
    }

    // Email opcional, mas se fornecido deve ser válido
    if (formData.email?.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.email)) {
        validationErrors.email = 'Email deve ter um formato válido';
      }
    }

    return validationErrors;
  }, [formData.nome, formData.telefone, formData.email]);

  const isValid = useMemo(() => {
    return Object.keys(errors).length === 0;
  }, [errors]);

  const getFieldError = (field: keyof ValidationErrors) => {
    return errors[field];
  };

  const hasFieldError = (field: keyof ValidationErrors) => {
    return !!errors[field];
  };

  return {
    errors,
    isValid,
    getFieldError,
    hasFieldError
  };
}