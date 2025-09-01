import type { Lead } from '../types/leads';
import { validateLeadData, sanitizeLeadData } from '../utils/leadValidation';

/**
 * Lead Validation Service
 * Centralized validation and business rules
 */
export class LeadValidationService {
  private static instance: LeadValidationService;

  static getInstance(): LeadValidationService {
    if (!LeadValidationService.instance) {
      LeadValidationService.instance = new LeadValidationService();
    }
    return LeadValidationService.instance;
  }

  /**
   * Validate lead creation data
   */
  validateForCreation(data: Partial<Lead>): { isValid: boolean; errors: string[] } {
    const errors = validateLeadData(data);
    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate lead update data
   */
  validateForUpdate(data: Partial<Lead>): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // For updates, only validate provided fields
    if (data.email && !this.isValidEmail(data.email)) {
      errors.push('Email inválido');
    }

    if (data.telefone && !this.isValidPhone(data.telefone)) {
      errors.push('Telefone inválido');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Sanitize lead data before saving
   */
  sanitize(data: Partial<Lead>): Partial<Lead> {
    return sanitizeLeadData(data);
  }

  /**
   * Check if lead can be converted
   */
  canBeConverted(lead: Lead): { canConvert: boolean; reason?: string } {
    if (lead.status === 'convertido') {
      return { canConvert: false, reason: 'Lead já foi convertido' };
    }

    if (lead.status === 'perdido') {
      return { canConvert: false, reason: 'Lead foi marcado como perdido' };
    }

    if (lead.arquivado) {
      return { canConvert: false, reason: 'Lead está arquivado' };
    }

    return { canConvert: true };
  }

  /**
   * Check if lead can be deleted
   */
  canBeDeleted(lead: Lead): { canDelete: boolean; reason?: string } {
    if (lead.clienteId) {
      return { 
        canDelete: false, 
        reason: 'Lead está vinculado a um cliente. Desvincule primeiro.' 
      };
    }

    return { canDelete: true };
  }

  /**
   * Validate status transition
   */
  validateStatusTransition(currentStatus: string, newStatus: string): { isValid: boolean; reason?: string } {
    // Define valid status transitions
    const validTransitions: Record<string, string[]> = {
      'novo': ['contatado', 'interessado', 'perdido'],
      'contatado': ['interessado', 'aguardando', 'negociacao', 'perdido'],
      'interessado': ['aguardando', 'negociacao', 'perdido'],
      'aguardando': ['negociacao', 'proposta_aceita', 'perdido'],
      'negociacao': ['proposta_aceita', 'convertido', 'perdido'],
      'proposta_aceita': ['convertido', 'perdido'],
      'convertido': [], // Final status
      'perdido': [] // Final status
    };

    const allowedTransitions = validTransitions[currentStatus] || [];
    
    if (!allowedTransitions.includes(newStatus)) {
      return {
        isValid: false,
        reason: `Transição de "${currentStatus}" para "${newStatus}" não é permitida`
      };
    }

    return { isValid: true };
  }

  /**
   * Business rule: Check if lead needs follow-up
   */
  needsFollowUp(lead: Lead, followUpDays: number = 3): boolean {
    if (lead.status === 'convertido' || lead.status === 'perdido') {
      return false;
    }

    if (!lead.ultimaInteracao) {
      return true;
    }

    const lastInteractionDate = new Date(lead.ultimaInteracao);
    const daysSinceLastInteraction = Math.floor(
      (Date.now() - lastInteractionDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    return daysSinceLastInteraction >= followUpDays;
  }

  /**
   * Private helper methods
   */
  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email.trim());
  }

  private isValidPhone(phone: string): boolean {
    const cleanPhone = phone.replace(/\D/g, '');
    return cleanPhone.length >= 10 && cleanPhone.length <= 11;
  }
}