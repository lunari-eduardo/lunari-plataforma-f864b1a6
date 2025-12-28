import { useCallback } from 'react';
import { useSupabaseLeads } from './useSupabaseLeads';
import { useAppContext } from '@/contexts/AppContext';
import type { Lead } from '@/types/leads';

/**
 * Hook para gerenciar leads - agora usando Supabase
 * Mantém compatibilidade com interface anterior
 */
export function useLeads() {
  const {
    leads,
    isLoading,
    addLead: supabaseAddLead,
    updateLead: supabaseUpdateLead,
    deleteLead: supabaseDeleteLead,
    convertToClient: supabaseConvertToClient,
  } = useSupabaseLeads();

  const { adicionarCliente, clientes } = useAppContext();

  // Wrapper para addLead que também cria cliente no CRM local se necessário
  const addLead = useCallback(
    async (input: Omit<Lead, 'id' | 'dataCriacao'>) => {
      console.log('🚀 [LEADS] Iniciando criação de lead:', { nome: input.nome, origem: input.origem });

      // Criar cliente no CRM se não tiver clienteId
      let clienteId = input.clienteId;
      if (!clienteId) {
        const clienteData = {
          nome: input.nome,
          email: input.email,
          telefone: input.telefone,
          whatsapp: input.whatsapp || input.telefone,
          origem: input.origem || 'Não informado',
        };

        console.log('🔄 [LEADS] Criando cliente no CRM:', clienteData);
        const novoCliente = adicionarCliente(clienteData);
        clienteId = novoCliente.id;
        console.log('✅ [LEADS] Cliente criado no CRM:', { id: clienteId, origem: novoCliente.origem });
      }

      // Criar lead no Supabase com clienteId
      const finalLead = await supabaseAddLead({
        ...input,
        clienteId,
      });

      return finalLead;
    },
    [adicionarCliente, supabaseAddLead]
  );

  // Wrapper para updateLead
  const updateLead = useCallback(
    (id: string, updates: Partial<Lead> | ((lead: Lead) => Lead)) => {
      supabaseUpdateLead(id, updates);
    },
    [supabaseUpdateLead]
  );

  // Wrapper para deleteLead
  const deleteLead = useCallback(
    (id: string) => {
      supabaseDeleteLead(id);
    },
    [supabaseDeleteLead]
  );

  // Wrapper para convertToClient usando lógica local também
  const convertToClient = useCallback(
    async (leadId: string) => {
      const lead = leads.find((l) => l.id === leadId);
      if (!lead) return null;

      // Verificar se já existe cliente com mesmo email
      const existingClient = clientes.find(
        (c) => c.email?.toLowerCase() === lead.email.toLowerCase()
      );

      if (existingClient) {
        // Associar lead ao cliente existente
        supabaseUpdateLead(leadId, {
          clienteId: existingClient.id,
          nome: existingClient.nome,
          email: existingClient.email,
          telefone: existingClient.telefone,
          whatsapp: existingClient.whatsapp || lead.whatsapp || '',
        });
        console.log('✅ [LEADS] Lead associado ao cliente existente:', { leadId, clienteId: existingClient.id });
        return existingClient;
      }

      // Usar conversão do Supabase que cria cliente
      const result = await supabaseConvertToClient(leadId);
      return result;
    },
    [leads, clientes, supabaseUpdateLead, supabaseConvertToClient]
  );

  return {
    leads,
    isLoading,
    addLead,
    updateLead,
    deleteLead,
    convertToClient,
  };
}
