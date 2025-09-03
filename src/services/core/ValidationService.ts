/**
 * Centralized Validation Service
 * Provides consistent validation patterns across the application
 */

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings?: string[];
}

export interface FieldValidation {
  field: string;
  message: string;
  severity: 'error' | 'warning';
}

export class ValidationService {
  private static instance: ValidationService;

  static getInstance(): ValidationService {
    if (!ValidationService.instance) {
      ValidationService.instance = new ValidationService();
    }
    return ValidationService.instance;
  }

  /**
   * Validate required fields
   */
  validateRequired(data: Record<string, any>, requiredFields: string[]): ValidationResult {
    const errors: string[] = [];
    
    requiredFields.forEach(field => {
      const value = data[field];
      if (value === null || value === undefined || value === '') {
        errors.push(`${field} é obrigatório`);
      }
    });

    return { isValid: errors.length === 0, errors };
  }

  /**
   * Validate email format
   */
  validateEmail(email: string): ValidationResult {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const isValid = emailRegex.test(email);
    
    return {
      isValid,
      errors: isValid ? [] : ['Email deve ter um formato válido']
    };
  }

  /**
   * Validate phone number (WhatsApp)
   */
  validatePhone(phone: string): ValidationResult {
    const phoneRegex = /^\(\d{2}\)\s\d{4,5}-\d{4}$/;
    const isValid = phoneRegex.test(phone) || phone.length >= 10;
    
    return {
      isValid,
      errors: isValid ? [] : ['Telefone deve ter um formato válido']
    };
  }

  /**
   * Validate currency values
   */
  validateCurrency(value: number, min = 0, max = Infinity): ValidationResult {
    const errors: string[] = [];
    
    if (isNaN(value)) {
      errors.push('Valor deve ser um número válido');
    } else if (value < min) {
      errors.push(`Valor deve ser maior ou igual a ${min}`);
    } else if (value > max) {
      errors.push(`Valor deve ser menor ou igual a ${max}`);
    }

    return { isValid: errors.length === 0, errors };
  }

  /**
   * Validate date ranges
   */
  validateDateRange(startDate: Date, endDate: Date): ValidationResult {
    const errors: string[] = [];
    
    if (!(startDate instanceof Date) || isNaN(startDate.getTime())) {
      errors.push('Data inicial inválida');
    }
    
    if (!(endDate instanceof Date) || isNaN(endDate.getTime())) {
      errors.push('Data final inválida');
    }
    
    if (errors.length === 0 && startDate > endDate) {
      errors.push('Data inicial deve ser anterior à data final');
    }

    return { isValid: errors.length === 0, errors };
  }

  /**
   * Validate percentage values
   */
  validatePercentage(value: number, allowZero = true): ValidationResult {
    const errors: string[] = [];
    const min = allowZero ? 0 : 0.01;
    
    if (isNaN(value)) {
      errors.push('Percentual deve ser um número válido');
    } else if (value < min) {
      errors.push(allowZero ? 'Percentual não pode ser negativo' : 'Percentual deve ser maior que zero');
    } else if (value > 100) {
      errors.push('Percentual não pode ser superior a 100%');
    }

    return { isValid: errors.length === 0, errors };
  }

  /**
   * Combine multiple validation results
   */
  combineValidations(...validations: ValidationResult[]): ValidationResult {
    const allErrors = validations.flatMap(v => v.errors);
    const allWarnings = validations.flatMap(v => v.warnings || []);

    return {
      isValid: allErrors.length === 0,
      errors: allErrors,
      warnings: allWarnings.length > 0 ? allWarnings : undefined
    };
  }

  /**
   * Validate object with field-specific rules
   */
  validateObject<T extends Record<string, any>>(
    data: T,
    rules: Record<keyof T, (value: any) => ValidationResult>
  ): ValidationResult & { fieldErrors: Record<string, string[]> } {
    const fieldErrors: Record<string, string[]> = {};
    const allErrors: string[] = [];

    Object.entries(rules).forEach(([field, validator]) => {
      const result = validator(data[field]);
      if (!result.isValid) {
        fieldErrors[field] = result.errors;
        allErrors.push(...result.errors);
      }
    });

    return {
      isValid: allErrors.length === 0,
      errors: allErrors,
      fieldErrors
    };
  }

  /**
   * Validate array data
   */
  validateArray<T>(
    items: T[],
    itemValidator: (item: T, index: number) => ValidationResult
  ): ValidationResult & { itemErrors: Array<{ index: number; errors: string[] }> } {
    const itemErrors: Array<{ index: number; errors: string[] }> = [];
    const allErrors: string[] = [];

    items.forEach((item, index) => {
      const result = itemValidator(item, index);
      if (!result.isValid) {
        itemErrors.push({ index, errors: result.errors });
        allErrors.push(...result.errors.map(error => `Item ${index + 1}: ${error}`));
      }
    });

    return {
      isValid: allErrors.length === 0,
      errors: allErrors,
      itemErrors
    };
  }
}

// Export singleton instance
export const validationService = ValidationService.getInstance();