import { useEffect, useState, useCallback } from 'react';
import { storage, STORAGE_KEYS } from '@/utils/localStorage';
import { useAppContext } from '@/contexts/AppContext';
import type { Lead } from '@/types/leads';

export function useLeads() {
  const [leads, setLeads] = useState<Lead[]>(() => {
    const loadedLeads = storage.load<Lead[]>(STORAGE_KEYS.LEADS, []);
    return loadedLeads;
  });

  const { adicionarCliente, clientes } = useAppContext();

  // Debounced save to prevent race conditions
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      storage.save(STORAGE_KEYS.LEADS, leads);
      window.dispatchEvent(new CustomEvent('leads:changed'));
    }, 100);

    return () => clearTimeout(timeoutId);
  }, [leads]);

  // Listen for external changes
  useEffect(() => {
    const reload = () => {
      const latest = storage.load<Lead[]>(STORAGE_KEYS.LEADS, []);
      setLeads((prev) => {
        try {
          if (JSON.stringify(prev) === JSON.stringify(latest)) return prev;
        } catch {}
        return latest;
      });
    };

    const onStorage = (e: StorageEvent) => {
      if (!e.key || e.key === STORAGE_KEYS.LEADS) reload();
    };

    window.addEventListener('storage', onStorage);
    window.addEventListener('leads:changed', reload as EventListener);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('leads:changed', reload as EventListener);
    };
  }, []);

  const addLead = useCallback((input: Omit<Lead, 'id' | 'dataCriacao'>) => {
    const now = new Date().toISOString();
    const lead: Lead = {
      ...input,
      id: `lead_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      dataCriacao: now,
      interacoes: input.interacoes || [],
      statusTimestamp: now,
    };

    // Auto-create client in CRM with proper origin mapping
    if (!lead.clienteId) {
      const clienteData = {
        nome: lead.nome,
        email: lead.email,
        telefone: lead.telefone,
        whatsapp: lead.whatsapp || lead.telefone,
        origem: lead.origem || 'Não informado'
      };
      
      const novoCliente = adicionarCliente(clienteData);
      lead.clienteId = novoCliente.id;
    }

    // Synchronous state update to prevent race conditions
    setLeads(prev => {
      const newLeads = [lead, ...prev];
      return newLeads;
    });
    
    return lead;
  }, [adicionarCliente]);

  const updateLead = useCallback((id: string, updates: Partial<Lead> | ((lead: Lead) => Lead)) => {
    setLeads(prev => prev.map(lead => {
      if (lead.id !== id) return lead;
      
      if (typeof updates === 'function') {
        return updates(lead);
      }
      
      const updatedLead = { ...lead, ...updates };
      
      // Track status changes
      if (updates.status && updates.status !== lead.status) {
        updatedLead.statusTimestamp = new Date().toISOString();
        updatedLead.needsFollowUp = false; // Reset follow-up when status changes
      }
      
      return updatedLead;
    }));
  }, []);

  const deleteLead = useCallback((id: string) => {
    setLeads(prev => prev.filter(lead => lead.id !== id));
  }, []);

  const convertToClient = useCallback((leadId: string) => {
    const lead = leads.find(l => l.id === leadId);
    if (!lead) return null;

    // Verificar se já existe cliente com mesmo email
    const existingClient = clientes.find(c => 
      c.email?.toLowerCase() === lead.email.toLowerCase()
    );

    if (existingClient) {
      // Associar lead ao cliente existente
      updateLead(leadId, { clienteId: existingClient.id });
      return existingClient;
    }

    // Criar novo cliente
    const novoCliente = adicionarCliente({
      nome: lead.nome,
      email: lead.email,
      telefone: lead.telefone,
      whatsapp: lead.whatsapp || '',
      origem: lead.origem || ''
    });

    // Associar lead ao novo cliente
    updateLead(leadId, { clienteId: novoCliente.id });
    
    return novoCliente;
  }, [leads, clientes, updateLead, adicionarCliente]);

  const convertToOrcamento = useCallback((leadId: string) => {
    const lead = leads.find(l => l.id === leadId);
    if (!lead) return null;

    // Primeiro, converter para cliente se necessário
    const cliente = convertToClient(leadId);
    if (!cliente) return null;

    // Marcar lead como convertido
    updateLead(leadId, { 
      status: 'convertido',
      orcamentoId: `orcamento_${Date.now()}` // Será usado quando criar o orçamento
    });

    return {
      cliente,
      lead,
      // Dados pré-preenchidos para o orçamento
      dadosOrcamento: {
        clienteId: cliente.id,
        nomeCliente: cliente.nome,
        email: cliente.email,
        telefone: cliente.telefone,
        whatsapp: cliente.whatsapp,
        origem: lead.origem,
        observacoes: lead.observacoes
      }
    };
  }, [leads, convertToClient, updateLead]);

  return { 
    leads, 
    addLead, 
    updateLead, 
    deleteLead, 
    convertToClient,
    convertToOrcamento
  };
}