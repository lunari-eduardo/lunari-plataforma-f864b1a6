import { formatDistanceToNowStrict } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { Lead } from '../types/leads';

/**
 * Formats phone number for display
 */
export const formatPhoneForDisplay = (phone: string): string => {
  const clean = phone.replace(/\D/g, '');
  
  if (clean.length === 11) {
    return `(${clean.slice(0, 2)}) ${clean.slice(2, 7)}-${clean.slice(7)}`;
  } else if (clean.length === 10) {
    return `(${clean.slice(0, 2)}) ${clean.slice(2, 6)}-${clean.slice(6)}`;
  }
  
  return phone;
};

/**
 * Formats time since creation
 */
export const formatTimeSinceCreation = (dateString: string): string => {
  try {
    return formatDistanceToNowStrict(new Date(dateString), { 
      addSuffix: true, 
      locale: ptBR 
    });
  } catch {
    return 'Data inválida';
  }
};

/**
 * Formats lead status for display
 */
export const formatLeadStatus = (status: string): string => {
  const statusMap: Record<string, string> = {
    'novo': 'Novo',
    'contatado': 'Contatado',
    'interessado': 'Interessado',
    'aguardando': 'Aguardando',
    'negociacao': 'Em Negociação',
    'proposta_aceita': 'Proposta Aceita',
    'convertido': 'Convertido',
    'perdido': 'Perdido',
    'arquivado': 'Arquivado'
  };
  
  return statusMap[status] || status;
};

/**
 * Creates WhatsApp URL for lead
 */
export const createWhatsAppUrl = (lead: Lead, message?: string): string => {
  const phone = lead.whatsapp || lead.telefone;
  const cleanPhone = phone.replace(/\D/g, '');
  const defaultMessage = message || `Olá ${lead.nome}! Tudo bem?`;
  const encodedMessage = encodeURIComponent(defaultMessage);
  
  return `https://wa.me/55${cleanPhone}?text=${encodedMessage}`;
};