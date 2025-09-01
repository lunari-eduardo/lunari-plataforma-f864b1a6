import type { Lead } from '../types/leads';
import { LeadStorageService } from './LeadStorageService';

/**
 * Lead Synchronization Service
 * Handles integration with CRM and other systems
 */
export class LeadSyncService {
  private static instance: LeadSyncService;
  private storageService: LeadStorageService;

  constructor() {
    this.storageService = LeadStorageService.getInstance();
  }

  static getInstance(): LeadSyncService {
    if (!LeadSyncService.instance) {
      LeadSyncService.instance = new LeadSyncService();
    }
    return LeadSyncService.instance;
  }

  /**
   * Link lead to existing CRM client
   */
  linkToClient(leadId: string, clienteId: string): boolean {
    try {
      const lead = this.storageService.getLeadById(leadId);
      if (!lead) return false;

      const updated = this.storageService.updateLead(leadId, {
        clienteId,
        dataAtualizacao: new Date().toISOString()
      });

      if (updated) {
        // Add interaction about the linking
        this.storageService.addInteraction(leadId, {
          leadId,
          tipo: 'manual',
          descricao: 'Lead vinculado ao cliente CRM',
          automatica: true,
          detalhes: `Cliente ID: ${clienteId}`
        });
      }

      return !!updated;
    } catch (error) {
      console.error('❌ [LeadSyncService] Error linking to client:', error);
      return false;
    }
  }

  /**
   * Unlink lead from CRM client
   */
  unlinkFromClient(leadId: string): boolean {
    try {
      const updated = this.storageService.updateLead(leadId, {
        clienteId: undefined,
        dataAtualizacao: new Date().toISOString()
      });

      if (updated) {
        this.storageService.addInteraction(leadId, {
          leadId,
          tipo: 'manual',
          descricao: 'Lead desvinculado do cliente CRM',
          automatica: true
        });
      }

      return !!updated;
    } catch (error) {
      console.error('❌ [LeadSyncService] Error unlinking from client:', error);
      return false;
    }
  }

  /**
   * Sync lead data with external systems
   */
  async syncWithExternalSystems(leadId: string): Promise<boolean> {
    try {
      const lead = this.storageService.getLeadById(leadId);
      if (!lead) return false;

      // Future: Implement sync with Supabase, CRM APIs, etc.
      // For now, just update timestamp
      const updated = this.storageService.updateLead(leadId, {
        dataAtualizacao: new Date().toISOString()
      });

      return !!updated;
    } catch (error) {
      console.error('❌ [LeadSyncService] Error syncing with external systems:', error);
      return false;
    }
  }

  /**
   * Auto-repair data integrity issues
   */
  repairDataIntegrity(): { fixed: number; errors: string[] } {
    const leads = this.storageService.getLeads();
    const errors: string[] = [];
    let fixed = 0;

    const repairedLeads = leads.map(lead => {
      let needsRepair = false;
      const repaired = { ...lead };

      // Ensure required fields
      if (!repaired.id) {
        repaired.id = crypto.randomUUID();
        needsRepair = true;
        fixed++;
      }

      if (!repaired.dataCriacao) {
        repaired.dataCriacao = new Date().toISOString();
        needsRepair = true;
        fixed++;
      }

      if (!repaired.interacoes) {
        repaired.interacoes = [];
        needsRepair = true;
        fixed++;
      }

      // Validate status
      if (!repaired.status) {
        repaired.status = 'novo';
        needsRepair = true;
        fixed++;
      }

      return needsRepair ? repaired : lead;
    });

    if (fixed > 0) {
      this.storageService.saveLeads(repairedLeads);
    }

    return { fixed, errors };
  }
}