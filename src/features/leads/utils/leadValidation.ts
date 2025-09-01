import type { Lead } from '../types/leads';

/**
 * Validates lead data before saving
 */
export const validateLeadData = (lead: Partial<Lead>): string[] => {
  const errors: string[] = [];

  if (!lead.nome?.trim()) {
    errors.push('Nome é obrigatório');
  }

  if (!lead.email?.trim()) {
    errors.push('Email é obrigatório');
  } else if (!isValidEmail(lead.email)) {
    errors.push('Email inválido');
  }

  if (!lead.telefone?.trim()) {
    errors.push('Telefone é obrigatório');
  } else if (!isValidPhone(lead.telefone)) {
    errors.push('Telefone inválido');
  }

  return errors;
};

/**
 * Validates email format
 */
export const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim());
};

/**
 * Validates phone format (Brazilian format)
 */
export const isValidPhone = (phone: string): boolean => {
  const cleanPhone = phone.replace(/\D/g, '');
  return cleanPhone.length >= 10 && cleanPhone.length <= 11;
};

/**
 * Sanitizes lead data
 */
export const sanitizeLeadData = (lead: Partial<Lead>): Partial<Lead> => {
  return {
    ...lead,
    nome: lead.nome?.trim(),
    email: lead.email?.trim().toLowerCase(),
    telefone: lead.telefone?.replace(/\D/g, ''),
    whatsapp: lead.whatsapp?.replace(/\D/g, ''),
    observacoes: lead.observacoes?.trim(),
  };
};