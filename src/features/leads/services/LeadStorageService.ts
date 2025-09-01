import { storage, STORAGE_KEYS } from '@/utils/localStorage';
import type { Lead } from '../types/leads';
import type { LeadInteraction } from '../types/leadInteractions';

/**
 * Centralized Lead Storage Service
 * Handles all lead data persistence with atomic operations
 */
export class LeadStorageService {
  private static instance: LeadStorageService;

  static getInstance(): LeadStorageService {
    if (!LeadStorageService.instance) {
      LeadStorageService.instance = new LeadStorageService();
    }
    return LeadStorageService.instance;
  }

  /**
   * Get all leads
   */
  getLeads(): Lead[] {
    try {
      return storage.load<Lead[]>(STORAGE_KEYS.LEADS, []);
    } catch (error) {
      console.error('❌ [LeadStorageService] Error loading leads:', error);
      return [];
    }
  }

  /**
   * Save leads with atomic operation
   */
  saveLeads(leads: Lead[]): boolean {
    try {
      storage.save(STORAGE_KEYS.LEADS, leads);
      this.dispatchChangeEvent(leads.length);
      return true;
    } catch (error) {
      console.error('❌ [LeadStorageService] Error saving leads:', error);
      return false;
    }
  }

  /**
   * Get lead by ID
   */
  getLeadById(id: string): Lead | null {
    const leads = this.getLeads();
    return leads.find(lead => lead.id === id) || null;
  }

  /**
   * Update single lead
   */
  updateLead(id: string, updates: Partial<Lead>): Lead | null {
    const leads = this.getLeads();
    const leadIndex = leads.findIndex(l => l.id === id);
    
    if (leadIndex === -1) return null;

    const updatedLead = {
      ...leads[leadIndex],
      ...updates,
      dataAtualizacao: new Date().toISOString()
    };

    leads[leadIndex] = updatedLead;
    
    if (this.saveLeads(leads)) {
      return updatedLead;
    }
    
    return null;
  }

  /**
   * Add new lead
   */
  addLead(lead: Omit<Lead, 'id' | 'dataCriacao' | 'interacoes'>): Lead {
    const leads = this.getLeads();
    const newLead: Lead = {
      ...lead,
      id: crypto.randomUUID(),
      dataCriacao: new Date().toISOString(),
      interacoes: []
    };

    leads.push(newLead);
    this.saveLeads(leads);
    
    return newLead;
  }

  /**
   * Delete lead
   */
  deleteLead(id: string): boolean {
    const leads = this.getLeads();
    const filteredLeads = leads.filter(l => l.id !== id);
    
    if (filteredLeads.length === leads.length) {
      return false; // Lead not found
    }
    
    return this.saveLeads(filteredLeads);
  }

  /**
   * Atomic batch update
   */
  batchUpdate(updater: (leads: Lead[]) => Lead[]): Lead[] {
    try {
      const currentLeads = this.getLeads();
      const updatedLeads = updater(currentLeads);
      
      if (this.saveLeads(updatedLeads)) {
        return updatedLeads;
      }
      
      return currentLeads;
    } catch (error) {
      console.error('❌ [LeadStorageService] Batch update failed:', error);
      return this.getLeads();
    }
  }

  /**
   * Add interaction to lead
   */
  addInteraction(leadId: string, interaction: Omit<LeadInteraction, 'id' | 'timestamp'>): boolean {
    const lead = this.getLeadById(leadId);
    if (!lead) return false;

    const newInteraction: LeadInteraction = {
      ...interaction,
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString()
    };

    const updatedLead = this.updateLead(leadId, {
      interacoes: [...(lead.interacoes || []), newInteraction],
      ultimaInteracao: newInteraction.timestamp
    });

    return updatedLead !== null;
  }

  /**
   * Dispatch storage change event
   */
  private dispatchChangeEvent(count: number): void {
    window.dispatchEvent(new CustomEvent('leads:changed', { 
      detail: { count } 
    }));
  }

  /**
   * Clear all lead data (for testing/reset)
   */
  clearAll(): void {
    storage.remove(STORAGE_KEYS.LEADS);
    this.dispatchChangeEvent(0);
  }
}