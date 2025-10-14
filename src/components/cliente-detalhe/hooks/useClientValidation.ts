export function useClientValidation() {
  const validateRequired = (value: string, fieldName: string) => {
    if (!value || value.trim() === '') {
      return { isValid: false, message: `${fieldName} é obrigatório` };
    }
    return { isValid: true };
  };

  const validateEmail = (email: string) => {
    if (!email) return { isValid: true }; // Email é opcional
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return { isValid: false, message: 'Email inválido' };
    }
    return { isValid: true };
  };

  const validatePhone = (phone: string) => {
    if (!phone) return { isValid: true }; // Telefone agora é opcional
    
    // Se preenchido, validar formato
    const cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.length < 10 || cleanPhone.length > 11) {
      return { isValid: false, message: 'Telefone deve ter 10 ou 11 dígitos' };
    }
    return { isValid: true };
  };

  const validateForm = (formData: any) => {
    // Validar nome (obrigatório)
    const nomeValidation = validateRequired(formData.nome, 'Nome');
    if (!nomeValidation.isValid) return nomeValidation;

    // Validar telefone (OPCIONAL, mas formato deve ser válido se preenchido)
    const phoneValidation = validatePhone(formData.telefone);
    if (!phoneValidation.isValid) return phoneValidation;

    // Validar email (opcional, mas formato deve ser válido se preenchido)
    const emailValidation = validateEmail(formData.email);
    if (!emailValidation.isValid) return emailValidation;

    return { isValid: true, message: 'Dados válidos' };
  };

  return {
    validateRequired,
    validateEmail,
    validatePhone,
    validateForm
  };
}