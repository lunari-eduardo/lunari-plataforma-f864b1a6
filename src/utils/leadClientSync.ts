import { storage, STORAGE_KEYS } from '@/utils/localStorage';
import type { Lead } from '@/types/leads';
import type { Cliente } from '@/types/orcamentos';

/**
 * Utility functions for synchronizing leads with CRM clients
 * Provides bidirectional sync and integrity repair
 */

/**
 * Sync leads when a client is updated in CRM
 */
export function syncLeadsWithClientUpdate(clienteId: string, updatedFields: Partial<Cliente>): void {
  try {
    const leads = storage.load<Lead[]>(STORAGE_KEYS.LEADS, []);
    let hasChanges = false;

    const updatedLeads = leads.map(lead => {
      if (lead.clienteId !== clienteId) return lead;

      const updates: Partial<Lead> = {};
      
      // Sync updatable fields
      if (updatedFields.nome && lead.nome !== updatedFields.nome) {
        updates.nome = updatedFields.nome;
      }
      if (updatedFields.email && lead.email !== updatedFields.email) {
        updates.email = updatedFields.email;
      }
      if (updatedFields.telefone && lead.telefone !== updatedFields.telefone) {
        updates.telefone = updatedFields.telefone;
      }
      if (updatedFields.whatsapp && lead.whatsapp !== updatedFields.whatsapp) {
        updates.whatsapp = updatedFields.whatsapp;
      }

      // Only update if there are actual changes
      if (Object.keys(updates).length > 0) {
        hasChanges = true;
        console.log('🔄 [LeadSync] Sincronizando lead com cliente:', {
          leadId: lead.id,
          clienteId,
          updates
        });
        return { ...lead, ...updates };
      }

      return lead;
    });

    if (hasChanges) {
      storage.save(STORAGE_KEYS.LEADS, updatedLeads);
      
      // Dispatch event to notify lead components
      window.dispatchEvent(new CustomEvent('leads:changed', {
        detail: { 
          count: updatedLeads.length,
          source: 'client-update',
          clienteId
        }
      }));
      
      console.log('✅ [LeadSync] Leads sincronizados com sucesso');
    }
  } catch (error) {
    console.error('❌ [LeadSync] Erro ao sincronizar leads:', error);
  }
}

/**
 * Link a lead to an existing client
 */
export function linkLeadToClient(leadId: string, clienteId: string): boolean {
  try {
    const leads = storage.load<Lead[]>(STORAGE_KEYS.LEADS, []);
    const clients = storage.load<Cliente[]>(STORAGE_KEYS.CLIENTS, []);
    
    const client = clients.find(c => c.id === clienteId);
    if (!client) {
      console.error('❌ [LeadSync] Cliente não encontrado:', clienteId);
      return false;
    }

    const leadIndex = leads.findIndex(l => l.id === leadId);
    if (leadIndex === -1) {
      console.error('❌ [LeadSync] Lead não encontrado:', leadId);
      return false;
    }

    // Update lead with client data and link
    const updatedLead: Lead = {
      ...leads[leadIndex],
      clienteId,
      nome: client.nome,
      email: client.email,
      telefone: client.telefone,
      whatsapp: client.whatsapp || leads[leadIndex].whatsapp || ''
    };

    leads[leadIndex] = updatedLead;
    storage.save(STORAGE_KEYS.LEADS, leads);

    // Dispatch event
    window.dispatchEvent(new CustomEvent('leads:changed', {
      detail: { 
        count: leads.length,
        source: 'client-link',
        leadId,
        clienteId
      }
    }));

    console.log('✅ [LeadSync] Lead vinculado ao cliente:', { leadId, clienteId });
    return true;
  } catch (error) {
    console.error('❌ [LeadSync] Erro ao vincular lead ao cliente:', error);
    return false;
  }
}

/**
 * Check if lead data diverges from linked client
 */
export function checkLeadClientDivergence(lead: Lead): {
  hasDivergence: boolean;
  divergentFields: string[];
  clientData?: Cliente;
} {
  if (!lead.clienteId) {
    return { hasDivergence: false, divergentFields: [] };
  }

  try {
    const clients = storage.load<Cliente[]>(STORAGE_KEYS.CLIENTS, []);
    const client = clients.find(c => c.id === lead.clienteId);
    
    if (!client) {
      return { 
        hasDivergence: true, 
        divergentFields: ['clienteId'],
        clientData: undefined
      };
    }

    const divergentFields: string[] = [];
    
    if (lead.nome !== client.nome) divergentFields.push('nome');
    if (lead.email !== client.email) divergentFields.push('email');
    if (lead.telefone !== client.telefone) divergentFields.push('telefone');
    if (lead.whatsapp && client.whatsapp && lead.whatsapp !== client.whatsapp) {
      divergentFields.push('whatsapp');
    }

    return {
      hasDivergence: divergentFields.length > 0,
      divergentFields,
      clientData: client
    };
  } catch (error) {
    console.error('❌ [LeadSync] Erro ao verificar divergência:', error);
    return { hasDivergence: false, divergentFields: [] };
  }
}

/**
 * Sync lead data with its linked client
 */
export function syncLeadWithClient(leadId: string): boolean {
  try {
    const leads = storage.load<Lead[]>(STORAGE_KEYS.LEADS, []);
    const leadIndex = leads.findIndex(l => l.id === leadId);
    
    if (leadIndex === -1) {
      console.error('❌ [LeadSync] Lead não encontrado:', leadId);
      return false;
    }

    const lead = leads[leadIndex];
    if (!lead.clienteId) {
      console.error('❌ [LeadSync] Lead não está vinculado a um cliente');
      return false;
    }

    const clients = storage.load<Cliente[]>(STORAGE_KEYS.CLIENTS, []);
    const client = clients.find(c => c.id === lead.clienteId);
    
    if (!client) {
      console.error('❌ [LeadSync] Cliente vinculado não encontrado:', lead.clienteId);
      return false;
    }

    // Update lead with client data
    const updatedLead: Lead = {
      ...lead,
      nome: client.nome,
      email: client.email,
      telefone: client.telefone,
      whatsapp: client.whatsapp || lead.whatsapp || ''
    };

    leads[leadIndex] = updatedLead;
    storage.save(STORAGE_KEYS.LEADS, leads);

    // Dispatch event
    window.dispatchEvent(new CustomEvent('leads:changed', {
      detail: { 
        count: leads.length,
        source: 'client-sync',
        leadId
      }
    }));

    console.log('✅ [LeadSync] Lead sincronizado com cliente:', { leadId, clienteId: lead.clienteId });
    return true;
  } catch (error) {
    console.error('❌ [LeadSync] Erro ao sincronizar lead:', error);
    return false;
  }
}

/**
 * Find and repair orphaned leads (with invalid clienteId)
 */
export function repairLeadIntegrity(): {
  fixed: number;
  orphaned: number;
  repaired: Array<{ leadId: string; issue: string; action: string }>;
} {
  try {
    const leads = storage.load<Lead[]>(STORAGE_KEYS.LEADS, []);
    const clients = storage.load<Cliente[]>(STORAGE_KEYS.CLIENTS, []);
    const clientIds = new Set(clients.map(c => c.id));
    
    let fixed = 0;
    let orphaned = 0;
    const repaired: Array<{ leadId: string; issue: string; action: string }> = [];

    const repairedLeads = leads.map(lead => {
      // Check if lead has clienteId but client doesn't exist
      if (lead.clienteId && !clientIds.has(lead.clienteId)) {
        // Try to find client by email or name
        const matchingClient = clients.find(c => 
          (c.email && lead.email && c.email.toLowerCase() === lead.email.toLowerCase()) ||
          (c.nome && lead.nome && c.nome.toLowerCase() === lead.nome.toLowerCase())
        );

        if (matchingClient) {
          // Repair by linking to found client
          fixed++;
          repaired.push({
            leadId: lead.id,
            issue: `Cliente ${lead.clienteId} não encontrado`,
            action: `Revinculado ao cliente ${matchingClient.id} (${matchingClient.nome})`
          });
          
          return {
            ...lead,
            clienteId: matchingClient.id,
            nome: matchingClient.nome,
            email: matchingClient.email,
            telefone: matchingClient.telefone,
            whatsapp: matchingClient.whatsapp || lead.whatsapp || ''
          };
        } else {
          // Remove invalid clienteId
          orphaned++;
          repaired.push({
            leadId: lead.id,
            issue: `Cliente ${lead.clienteId} não encontrado`,
            action: 'ClienteId removido - lead se tornou independente'
          });
          
          const { clienteId, ...leadWithoutClientId } = lead;
          return leadWithoutClientId as Lead;
        }
      }

      return lead;
    });

    if (fixed > 0 || orphaned > 0) {
      storage.save(STORAGE_KEYS.LEADS, repairedLeads);
      
      // Dispatch event
      window.dispatchEvent(new CustomEvent('leads:changed', {
        detail: { 
          count: repairedLeads.length,
          source: 'integrity-repair'
        }
      }));

      console.log('✅ [LeadSync] Integridade reparada:', { fixed, orphaned, repaired });
    }

    return { fixed, orphaned, repaired };
  } catch (error) {
    console.error('❌ [LeadSync] Erro ao reparar integridade:', error);
    return { fixed: 0, orphaned: 0, repaired: [] };
  }
}

/**
 * Get available clients for linking (excluding already linked ones)
 */
export function getAvailableClientsForLinking(excludeLeadId?: string): Cliente[] {
  try {
    const leads = storage.load<Lead[]>(STORAGE_KEYS.LEADS, []);
    const clients = storage.load<Cliente[]>(STORAGE_KEYS.CLIENTS, []);
    
    // Get clientIds already linked to other leads
    const linkedClientIds = new Set(
      leads
        .filter(l => l.clienteId && l.id !== excludeLeadId)
        .map(l => l.clienteId!)
    );

    // Return clients not already linked
    return clients.filter(c => !linkedClientIds.has(c.id));
  } catch (error) {
    console.error('❌ [LeadSync] Erro ao obter clientes disponíveis:', error);
    return [];
  }
}