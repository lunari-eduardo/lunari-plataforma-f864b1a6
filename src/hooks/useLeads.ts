import { useEffect, useState, useCallback, useRef } from 'react';
import { storage, STORAGE_KEYS } from '@/utils/localStorage';
import { useAppContext } from '@/contexts/AppContext';
import { useLeadStorage } from './useLeadStorage';
import { getValidTimestamp } from '@/utils/leadFilters';
import type { Lead } from '@/types/leads';

export function useLeads() {
  const { loadLeads, atomicUpdate } = useLeadStorage();
  const [leads, setLeads] = useState<Lead[]>(() => loadLeads());
  const { adicionarCliente, clientes } = useAppContext();
  const autoArchiveExecuted = useRef(false);

  // Auto-arquivamento de leads finalizados há mais de 30 dias - com validação robusta
  const autoArchiveLeads = useCallback(() => {
    if (autoArchiveExecuted.current) {
      console.log('🔄 [LEADS] Auto-archive já executado nesta sessão');
      return leads;
    }

    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    let archivedCount = 0;
    
    const updatedLeads = atomicUpdate(prev => prev.map(lead => {
      // Verificar se deve ser arquivado automaticamente
      if (!lead.arquivado && (lead.status === 'fechado' || lead.status === 'perdido')) {
        // Usar timestamp validado com fallback
        const validTimestamp = getValidTimestamp(lead);
        
        if (validTimestamp < thirtyDaysAgo) {
          archivedCount++;
          console.log(`🗄️ [LEADS] Auto-arquivando lead ${lead.nome} - ${lead.status} desde ${validTimestamp.toLocaleDateString()}`);
          return {
            ...lead,
            arquivado: true,
            dataArquivamento: now.toISOString(),
            motivoArquivamento: 'automatico' as const
          };
        }
      }
      return lead;
    }));
    
    if (archivedCount > 0) {
      console.log(`✅ [LEADS] Auto-arquivamento concluído: ${archivedCount} leads arquivados`);
    } else {
      console.log('ℹ️ [LEADS] Nenhum lead precisa ser arquivado automaticamente');
    }
    
    autoArchiveExecuted.current = true;
    setLeads(updatedLeads);
    return updatedLeads;
  }, [atomicUpdate, leads]);

  // Executar auto-arquivamento ao carregar - apenas uma vez
  useEffect(() => {
    if (!autoArchiveExecuted.current) {
      autoArchiveLeads();
    }
  }, []); // Dependências vazias para executar apenas uma vez

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

    // 3. TERCEIRO: Criar lead final com clienteId e histórico inicial
    const finalLead: Lead = {
      ...lead,
      clienteId,
      dataAtualizacao: now,
      historicoStatus: [{
        status: lead.status,
        data: now
      }]
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
      
      const now = new Date().toISOString();
      const updatedLead = { 
        ...lead, 
        ...updates,
        dataAtualizacao: now
      };
      
      // Track status changes in history
      if (updates.status && updates.status !== lead.status) {
        updatedLead.statusTimestamp = now;
        updatedLead.needsFollowUp = false; // Reset follow-up when status changes
        
        // Ensure historicoStatus exists and add new status
        if (!updatedLead.historicoStatus) {
          updatedLead.historicoStatus = [{
            status: lead.status,
            data: lead.dataCriacao
          }];
        }
        
        updatedLead.historicoStatus.push({
          status: updates.status,
          data: now
        });
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


  // Função para arquivar/desarquivar manualmente
  const toggleArchive = useCallback((leadId: string, archive: boolean) => {
    const now = new Date().toISOString();
    updateLead(leadId, {
      arquivado: archive,
      dataArquivamento: archive ? now : undefined,
      motivoArquivamento: archive ? 'manual' : undefined
    });
  }, [updateLead]);

  return { 
    leads, 
    addLead, 
    updateLead, 
    deleteLead, 
    convertToClient,
    autoArchiveLeads,
    toggleArchive
  };
}