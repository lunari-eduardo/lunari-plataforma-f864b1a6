/**
 * Hook for real-time client management with Supabase
 * Replaces localStorage-based client system with real-time database
 */

import { useEffect, useCallback, useState, useMemo } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import type { 
  ClienteSupabase, 
  ClienteFamilia, 
  ClienteDocumento, 
  ClienteCompleto 
} from '@/types/cliente-supabase';

export function useClientesRealtime() {
  const [clientes, setClientes] = useState<ClienteSupabase[]>([]);
  const [familia, setFamilia] = useState<ClienteFamilia[]>([]);
  const [documentos, setDocumentos] = useState<ClienteDocumento[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // ============= INITIAL DATA LOADING =============
  
  useEffect(() => {
    const loadAllData = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const [clientesData, familiaData, documentosData] = await Promise.all([
          supabase.from('clientes').select('*').eq('user_id', user.id),
          supabase.from('clientes_familia').select('*').eq('user_id', user.id),
          supabase.from('clientes_documentos').select('*').eq('user_id', user.id)
        ]);

        if (clientesData.error) throw clientesData.error;
        if (familiaData.error) throw familiaData.error;
        if (documentosData.error) throw documentosData.error;

        setClientes(clientesData.data || []);
        setFamilia((familiaData.data || []) as ClienteFamilia[]);
        setDocumentos(documentosData.data || []);
        
        console.log('✅ All client data loaded');
      } catch (error) {
        console.error('❌ Error loading client data:', error);
        toast.error('Erro ao carregar dados dos clientes');
      } finally {
        setIsLoading(false);
      }
    };

    loadAllData();
  }, []);

  // ============= REAL-TIME SUBSCRIPTIONS =============
  
  useEffect(() => {
    const setupRealtime = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

    // Clientes subscription
    const clientesChannel = supabase
      .channel('clientes_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'clientes',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          console.log('🔄 Cliente change:', payload);
          
          if (payload.eventType === 'INSERT') {
            setClientes(prev => [...prev, payload.new as ClienteSupabase]);
          } else if (payload.eventType === 'UPDATE') {
            setClientes(prev => prev.map(c => 
              c.id === payload.new.id ? payload.new as ClienteSupabase : c
            ));
          } else if (payload.eventType === 'DELETE') {
            setClientes(prev => prev.filter(c => c.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    // Família subscription
    const familiaChannel = supabase
      .channel('familia_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'clientes_familia',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          console.log('🔄 Família change:', payload);
          
          if (payload.eventType === 'INSERT') {
            setFamilia(prev => [...prev, payload.new as ClienteFamilia]);
          } else if (payload.eventType === 'UPDATE') {
            setFamilia(prev => prev.map(f => 
              f.id === payload.new.id ? payload.new as ClienteFamilia : f
            ));
          } else if (payload.eventType === 'DELETE') {
            setFamilia(prev => prev.filter(f => f.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    // Documentos subscription
    const documentosChannel = supabase
      .channel('documentos_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'clientes_documentos',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          console.log('🔄 Documento change:', payload);
          
          if (payload.eventType === 'INSERT') {
            setDocumentos(prev => [...prev, payload.new as ClienteDocumento]);
          } else if (payload.eventType === 'UPDATE') {
            setDocumentos(prev => prev.map(d => 
              d.id === payload.new.id ? payload.new as ClienteDocumento : d
            ));
          } else if (payload.eventType === 'DELETE') {
            setDocumentos(prev => prev.filter(d => d.id !== payload.old.id));
          }
        }
      )
      .subscribe();

      return () => {
        supabase.removeChannel(clientesChannel);
        supabase.removeChannel(familiaChannel);
        supabase.removeChannel(documentosChannel);
      };
    };

    setupRealtime();
  }, []);

  // ============= CLIENTE OPERATIONS =============
  
  const adicionarCliente = useCallback(async (cliente: Omit<ClienteSupabase, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('clientes')
        .insert({
          ...cliente,
          user_id: user.id
        })
        .select()
        .single();

      if (error) throw error;
      
      toast.success('Cliente adicionado com sucesso');
      return data;
    } catch (error) {
      console.error('❌ Error adding client:', error);
      toast.error('Erro ao adicionar cliente');
      throw error;
    }
  }, []);

  const atualizarCliente = useCallback(async (id: string, dados: Partial<ClienteSupabase>) => {
    try {
      const { error } = await supabase
        .from('clientes')
        .update(dados)
        .eq('id', id);

      if (error) throw error;
      
      toast.success('Cliente atualizado com sucesso');
    } catch (error) {
      console.error('❌ Error updating client:', error);
      toast.error('Erro ao atualizar cliente');
      throw error;
    }
  }, []);

  const removerCliente = useCallback(async (id: string) => {
    try {
      const { error } = await supabase
        .from('clientes')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      toast.success('Cliente removido com sucesso');
    } catch (error) {
      console.error('❌ Error removing client:', error);
      toast.error('Erro ao remover cliente');
      throw error;
    }
  }, []);

  // ============= FAMÍLIA OPERATIONS =============
  
  const adicionarFamilia = useCallback(async (clienteId: string, membro: Omit<ClienteFamilia, 'id' | 'cliente_id' | 'user_id' | 'created_at'>) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('clientes_familia')
        .insert({
          ...membro,
          cliente_id: clienteId,
          user_id: user.id
        })
        .select()
        .single();

      if (error) throw error;
      
      toast.success('Membro da família adicionado');
      return data;
    } catch (error) {
      console.error('❌ Error adding family member:', error);
      toast.error('Erro ao adicionar membro da família');
      throw error;
    }
  }, []);

  const removerFamilia = useCallback(async (id: string) => {
    try {
      const { error } = await supabase
        .from('clientes_familia')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      toast.success('Membro da família removido');
    } catch (error) {
      console.error('❌ Error removing family member:', error);
      toast.error('Erro ao remover membro da família');
      throw error;
    }
  }, []);

  // ============= COMPUTED VALUES =============
  
  const clientesCompletos = useMemo((): ClienteCompleto[] => {
    return clientes.map(cliente => ({
      ...cliente,
      familia: familia.filter(f => f.cliente_id === cliente.id),
      documentos: documentos.filter(d => d.cliente_id === cliente.id)
    }));
  }, [clientes, familia, documentos]);

  const getClienteById = useCallback((id: string): ClienteCompleto | undefined => {
    return clientesCompletos.find(c => c.id === id);
  }, [clientesCompletos]);

  const searchClientes = useCallback((termo: string): ClienteCompleto[] => {
    if (!termo.trim()) return clientesCompletos;
    
    const termoBusca = termo.toLowerCase();
    return clientesCompletos.filter(cliente => 
      cliente.nome.toLowerCase().includes(termoBusca) ||
      cliente.email?.toLowerCase().includes(termoBusca) ||
      cliente.telefone.includes(termoBusca) ||
      cliente.whatsapp?.includes(termoBusca)
    );
  }, [clientesCompletos]);

  // ============= MIGRATION HELPER =============
  
  const migrarLocalStorageClientes = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Get existing clients from localStorage (if any)
      const localClientes = JSON.parse(localStorage.getItem('clientes') || '[]');
      
      if (localClientes.length === 0) {
        console.log('📱 No clients to migrate from localStorage');
        return;
      }

      console.log(`📱 Migrating ${localClientes.length} clients from localStorage`);
      
      // Convert and insert clients
      const clientesToInsert = localClientes.map((cliente: any) => ({
        id: cliente.id, // Preserve existing ID for compatibility
        user_id: user.id,
        nome: cliente.nome,
        email: cliente.email,
        telefone: cliente.telefone,
        whatsapp: cliente.whatsapp,
        endereco: cliente.endereco,
        observacoes: cliente.observacoes,
        origem: cliente.origem,
        data_nascimento: cliente.dataNascimento
      }));

      const { error } = await supabase
        .from('clientes')
        .insert(clientesToInsert);

      if (error) throw error;

      // Migrate family members if they exist
      for (const cliente of localClientes) {
        if (cliente.conjuge?.nome) {
          await adicionarFamilia(cliente.id, {
            tipo: 'conjuge',
            nome: cliente.conjuge.nome,
            data_nascimento: cliente.conjuge.dataNascimento
          });
        }

        if (cliente.filhos?.length > 0) {
          for (const filho of cliente.filhos) {
            if (filho.nome) {
              await adicionarFamilia(cliente.id, {
                tipo: 'filho',
                nome: filho.nome,
                data_nascimento: filho.dataNascimento
              });
            }
          }
        }
      }

      // Clear localStorage after successful migration
      localStorage.removeItem('clientes');
      
      toast.success(`${localClientes.length} clientes migrados com sucesso!`);
      console.log('✅ Migration completed successfully');
      
    } catch (error) {
      console.error('❌ Error migrating clients:', error);
      toast.error('Erro na migração dos clientes');
    }
  }, [adicionarFamilia]);

  return {
    // Data
    clientes: clientesCompletos,
    isLoading,
    
    // Client operations
    adicionarCliente,
    atualizarCliente,
    removerCliente,
    
    // Family operations
    adicionarFamilia,
    removerFamilia,
    
    // Utility functions
    getClienteById,
    searchClientes,
    
    // Migration
    migrarLocalStorageClientes
  };
}