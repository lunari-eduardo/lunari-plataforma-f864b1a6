// Utilitários para formatação e validação de dados do usuário

export const formatCpfCnpj = (value: string): string => {
  // Remove todos os caracteres que não são dígitos
  const digits = value.replace(/\D/g, '');
  
  if (digits.length <= 11) {
    // Formato CPF: 000.000.000-00
    return digits
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})/, '$1-$2');
  } else {
    // Formato CNPJ: 00.000.000/0000-00
    return digits
      .replace(/(\d{2})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1/$2')
      .replace(/(\d{4})(\d{1,2})/, '$1-$2');
  }
};

export const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export const validateCpfCnpj = (value: string): boolean => {
  const digits = value.replace(/\D/g, '');
  
  if (digits.length === 11) {
    // Validação básica de CPF
    return validateCpf(digits);
  } else if (digits.length === 14) {
    // Validação básica de CNPJ
    return validateCnpj(digits);
  }
  
  return false;
};

const validateCpf = (cpf: string): boolean => {
  // Verificar se todos os dígitos são iguais
  if (/^(\d)\1{10}$/.test(cpf)) return false;
  
  // Calcular primeiro dígito verificador
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(cpf[i]) * (10 - i);
  }
  let remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(cpf[9])) return false;
  
  // Calcular segundo dígito verificador
  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(cpf[i]) * (11 - i);
  }
  remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(cpf[10])) return false;
  
  return true;
};

const validateCnpj = (cnpj: string): boolean => {
  // Verificar se todos os dígitos são iguais
  if (/^(\d)\1{13}$/.test(cnpj)) return false;
  
  // Calcular primeiro dígito verificador
  let sum = 0;
  let weight = 2;
  for (let i = 11; i >= 0; i--) {
    sum += parseInt(cnpj[i]) * weight;
    weight++;
    if (weight === 10) weight = 2;
  }
  let remainder = sum % 11;
  const digit1 = remainder < 2 ? 0 : 11 - remainder;
  if (digit1 !== parseInt(cnpj[12])) return false;
  
  // Calcular segundo dígito verificador
  sum = 0;
  weight = 2;
  for (let i = 12; i >= 0; i--) {
    sum += parseInt(cnpj[i]) * weight;
    weight++;
    if (weight === 10) weight = 2;
  }
  remainder = sum % 11;
  const digit2 = remainder < 2 ? 0 : 11 - remainder;
  if (digit2 !== parseInt(cnpj[13])) return false;
  
  return true;
};

export const formatPhone = (value: string): string => {
  const digits = value.replace(/\D/g, '');
  
  if (digits.length <= 10) {
    // Formato: (00) 0000-0000
    return digits
      .replace(/(\d{2})(\d)/, '($1) $2')
      .replace(/(\d{4})(\d{1,4})/, '$1-$2');
  } else {
    // Formato: (00) 00000-0000
    return digits
      .replace(/(\d{2})(\d)/, '($1) $2')
      .replace(/(\d{5})(\d{1,4})/, '$1-$2');
  }
};

export const IDIOMAS_OPCOES = [
  { value: 'pt', label: 'Português' },
  { value: 'en', label: 'English' },
  { value: 'es', label: 'Español' }
];

export const FUSOS_HORARIOS_OPCOES = [
  { value: 'America/Sao_Paulo', label: 'Brasília (GMT-3)' },
  { value: 'America/Manaus', label: 'Manaus (GMT-4)' },
  { value: 'America/Rio_Branco', label: 'Rio Branco (GMT-5)' },
  { value: 'America/Noronha', label: 'Fernando de Noronha (GMT-2)' }
];

export const MOEDAS_OPCOES = [
  { value: 'BRL', label: 'Real Brasileiro (R$)' },
  { value: 'USD', label: 'Dólar Americano (US$)' },
  { value: 'EUR', label: 'Euro (€)' }
];

export const FORMATOS_DATA_OPCOES = [
  { value: 'DD/MM/YYYY', label: 'DD/MM/AAAA (31/12/2024)' },
  { value: 'MM/DD/YYYY', label: 'MM/DD/AAAA (12/31/2024)' },
  { value: 'YYYY-MM-DD', label: 'AAAA-MM-DD (2024-12-31)' }
];