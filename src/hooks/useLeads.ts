import { useEffect, useState, useCallback } from 'react';
import { storage, STORAGE_KEYS } from '@/utils/localStorage';
import { useAppContext } from '@/contexts/AppContext';
import { useLeadStorage } from './useLeadStorage';
import type { Lead } from '@/types/leads';

export function useLeads() {
  const { loadLeads, atomicUpdate } = useLeadStorage();
  const [leads, setLeads] = useState<Lead[]>(() => loadLeads());
  const { adicionarCliente, clientes } = useAppContext();

  // Listen for external changes only
  useEffect(() => {
    const handleLeadsChanged = (e: CustomEvent) => {
      console.log('🔄 [LEADS] Evento de mudança recebido:', e.detail);
      const latest = loadLeads();
      setLeads(latest);
    };

    const handleClientsUpdated = (e: CustomEvent) => {
      console.log('🔄 [LEADS] Cliente atualizado, verificando sincronização:', e.detail);
      const latest = loadLeads();
      setLeads(latest);
    };

    window.addEventListener('leads:changed', handleLeadsChanged as EventListener);
    window.addEventListener('clients:updated', handleClientsUpdated as EventListener);
    
    return () => {
      window.removeEventListener('leads:changed', handleLeadsChanged as EventListener);
      window.removeEventListener('clients:updated', handleClientsUpdated as EventListener);
    };
  }, [loadLeads]);

  const addLead = useCallback((input: Omit<Lead, 'id' | 'dataCriacao'>) => {
    console.log('🚀 [LEADS] Iniciando criação de lead:', { nome: input.nome, origem: input.origem });
    
    const now = new Date().toISOString();
    
    // 1. PRIMEIRO: Criar lead SEM mutação
    const leadId = `lead_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const lead: Lead = {
      ...input,
      id: leadId,
      dataCriacao: now,
      interacoes: input.interacoes || [],
      statusTimestamp: now,
    };

    console.log('✅ [LEADS] Lead criado em memória:', { id: lead.id, origem: lead.origem });

    // 2. SEGUNDO: Criar cliente CRM separadamente se necessário
    let clienteId = lead.clienteId;
    if (!clienteId) {
      const clienteData = {
        nome: lead.nome,
        email: lead.email,
        telefone: lead.telefone,
        whatsapp: lead.whatsapp || lead.telefone,
        origem: lead.origem || 'Não informado'
      };
      
      console.log('🔄 [LEADS] Criando cliente no CRM:', clienteData);
      const novoCliente = adicionarCliente(clienteData);
      clienteId = novoCliente.id;
      console.log('✅ [LEADS] Cliente criado no CRM:', { id: clienteId, origem: novoCliente.origem });
    }

    // 3. TERCEIRO: Criar lead final com clienteId
    const finalLead: Lead = {
      ...lead,
      clienteId
    };

    console.log('🎯 [LEADS] Lead final preparado:', { id: finalLead.id, clienteId: finalLead.clienteId, origem: finalLead.origem });

    // 4. QUARTO: Update state e storage atomicamente
    const updatedLeads = atomicUpdate(prev => [finalLead, ...prev]);
    setLeads(updatedLeads);
    
    return finalLead;
  }, [adicionarCliente, atomicUpdate]);

  const updateLead = useCallback((id: string, updates: Partial<Lead> | ((lead: Lead) => Lead)) => {
    const updatedLeads = atomicUpdate(prev => prev.map(lead => {
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
    setLeads(updatedLeads);
  }, [atomicUpdate]);

  const deleteLead = useCallback((id: string) => {
    const updatedLeads = atomicUpdate(prev => prev.filter(lead => lead.id !== id));
    setLeads(updatedLeads);
  }, [atomicUpdate]);

  const convertToClient = useCallback((leadId: string) => {
    const lead = leads.find(l => l.id === leadId);
    if (!lead) return null;

    // Verificar se já existe cliente com mesmo email
    const existingClient = clientes.find(c => 
      c.email?.toLowerCase() === lead.email.toLowerCase()
    );

    if (existingClient) {
      // Associar lead ao cliente existente e sincronizar dados
      updateLead(leadId, { 
        clienteId: existingClient.id,
        nome: existingClient.nome,
        email: existingClient.email,
        telefone: existingClient.telefone,
        whatsapp: existingClient.whatsapp || lead.whatsapp || ''
      });
      console.log('✅ [LEADS] Lead associado ao cliente existente:', { leadId, clienteId: existingClient.id });
      return existingClient;
    }

    // Criar novo cliente com dados do lead
    const novoCliente = adicionarCliente({
      nome: lead.nome,
      email: lead.email,
      telefone: lead.telefone,
      whatsapp: lead.whatsapp || '',
      origem: lead.origem || ''
    });

    // Associar lead ao novo cliente (dados já estão sincronizados)
    updateLead(leadId, { clienteId: novoCliente.id });
    console.log('✅ [LEADS] Novo cliente criado e vinculado:', { leadId, clienteId: novoCliente.id });
    
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