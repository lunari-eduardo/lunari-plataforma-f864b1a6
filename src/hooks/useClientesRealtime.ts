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
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) return;
        const userId = session.user.id;

        const [clientesData, familiaData, documentosData] = await Promise.all([
          supabase.from('clientes').select('*').eq('user_id', userId),
          supabase.from('clientes_familia').select('*').eq('user_id', userId),
          supabase.from('clientes_documentos').select('*').eq('user_id', userId)
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
    let clientesChannel: any = null;
    let familiaChannel: any = null;
    let documentosChannel: any = null;

    const setupRealtime = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;
      const userId = session.user.id;

      clientesChannel = supabase
        .channel(`clientes_changes_${userId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'clientes',
            filter: `user_id=eq.${userId}`,
          },
          (payload) => {
            console.log('🔄 Cliente change:', payload.eventType);
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

      familiaChannel = supabase
        .channel(`familia_changes_${userId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'clientes_familia',
            filter: `user_id=eq.${userId}`,
          },
          (payload) => {
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

      documentosChannel = supabase
        .channel(`documentos_changes_${userId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'clientes_documentos',
            filter: `user_id=eq.${userId}`,
          },
          (payload) => {
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
    };

    setupRealtime();

    return () => {
      if (clientesChannel) supabase.removeChannel(clientesChannel);
      if (familiaChannel) supabase.removeChannel(familiaChannel);
      if (documentosChannel) supabase.removeChannel(documentosChannel);
    };
  }, []);

  // ============= CLIENTE OPERATIONS =============
  
  const adicionarCliente = useCallback(async (cliente: Omit<ClienteSupabase, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) throw new Error('User not authenticated');
      const user = session.user;

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
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) throw new Error('User not authenticated');
      const user = session.user;

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

  const atualizarFamilia = useCallback(async (id: string, dados: Partial<ClienteFamilia>) => {
    try {
      const { error } = await supabase
        .from('clientes_familia')
        .update(dados)
        .eq('id', id);

      if (error) throw error;
      
      console.log('✅ Family member updated');
    } catch (error) {
      console.error('❌ Error updating family member:', error);
      toast.error('Erro ao atualizar membro da família');
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

  // ============= VERIFICAR DADOS VINCULADOS =============
  
  const verificarClienteTemDados = useCallback(async (id: string): Promise<{
    temDados: boolean;
    sessoes: number;
    pagamentos: number;
  }> => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) throw new Error('Usuário não autenticado');
      const user = session.user;

      // Verificar sessões
      const { count: sessoesCount, error: sessoesError } = await supabase
        .from('clientes_sessoes')
        .select('*', { count: 'exact', head: true })
        .eq('cliente_id', id)
        .eq('user_id', user.id);

      if (sessoesError) throw sessoesError;

      // Verificar transações
      const { count: transacoesCount, error: transacoesError } = await supabase
        .from('clientes_transacoes')
        .select('*', { count: 'exact', head: true })
        .eq('cliente_id', id)
        .eq('user_id', user.id);

      if (transacoesError) throw transacoesError;

      const sessoes = sessoesCount || 0;
      const pagamentos = transacoesCount || 0;

      return {
        temDados: sessoes > 0 || pagamentos > 0,
        sessoes,
        pagamentos
      };
    } catch (error) {
      console.error('❌ Erro ao verificar dados do cliente:', error);
      return { temDados: false, sessoes: 0, pagamentos: 0 };
    }
  }, []);

  // ============= SYNC FAMÍLIA COMPLETA =============
  
  const syncFamiliaData = useCallback(async (
    clienteId: string,
    conjuge: { nome?: string; dataNascimento?: string },
    filhos: Array<{ id: string; nome?: string; dataNascimento?: string }>
  ) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) throw new Error('User not authenticated');
      const user = session.user;

      // Buscar família atual do cliente
      const familiaAtual = familia.filter(f => f.cliente_id === clienteId);
      const conjugeAtual = familiaAtual.find(f => f.tipo === 'conjuge');
      const filhosAtuais = familiaAtual.filter(f => f.tipo === 'filho');

      // ===== SINCRONIZAR CÔNJUGE =====
      
      if (conjuge?.nome?.trim()) {
        // Cônjuge tem nome → criar ou atualizar
        if (conjugeAtual) {
          // Atualizar cônjuge existente
          await atualizarFamilia(conjugeAtual.id, {
            nome: conjuge.nome,
            data_nascimento: conjuge.dataNascimento || null
          });
        } else {
          // Criar novo cônjuge
          await adicionarFamilia(clienteId, {
            tipo: 'conjuge',
            nome: conjuge.nome,
            data_nascimento: conjuge.dataNascimento || null
          });
        }
      } else if (conjugeAtual) {
        // Cônjuge vazio e existe → deletar
        await removerFamilia(conjugeAtual.id);
      }

      // ===== SINCRONIZAR FILHOS =====
      
      // Identificar filhos que são do Supabase (têm UUID válido)
      const filhosSupabaseIds = filhosAtuais.map(f => f.id);
      const filhosParaManter = filhos.filter(f => 
        filhosSupabaseIds.includes(f.id) && f.nome?.trim()
      );
      const filhosParaCriar = filhos.filter(f => 
        !filhosSupabaseIds.includes(f.id) && f.nome?.trim()
      );
      const filhosParaDeletar = filhosAtuais.filter(f => 
        !filhos.some(filho => filho.id === f.id && filho.nome?.trim())
      );

      // Atualizar filhos existentes
      for (const filho of filhosParaManter) {
        await atualizarFamilia(filho.id, {
          nome: filho.nome,
          data_nascimento: filho.dataNascimento || null
        });
      }

      // Criar novos filhos
      for (const filho of filhosParaCriar) {
        await adicionarFamilia(clienteId, {
          tipo: 'filho',
          nome: filho.nome!,
          data_nascimento: filho.dataNascimento || null
        });
      }

      // Deletar filhos removidos
      for (const filho of filhosParaDeletar) {
        await removerFamilia(filho.id);
      }

      console.log('✅ Família sincronizada com sucesso');
    } catch (error) {
      console.error('❌ Erro ao sincronizar família:', error);
      throw error;
    }
  }, [familia, adicionarFamilia, atualizarFamilia, removerFamilia]);

  // ============= ATUALIZAR CLIENTE COMPLETO =============
  
  const atualizarClienteCompleto = useCallback(async (
    id: string, 
    dadosCliente: any
  ) => {
    try {
      // Separar dados do cliente dos dados da família
      const { conjuge, filhos, ...dadosBasicos } = dadosCliente;

      // 1. Atualizar dados básicos do cliente
      const updateData: Partial<ClienteSupabase> = {
        nome: dadosBasicos.nome,
        email: dadosBasicos.email || null,
        telefone: dadosBasicos.telefone || null,
        endereco: dadosBasicos.endereco || null,
        observacoes: dadosBasicos.observacoes || null,
        origem: dadosBasicos.origem || null,
        data_nascimento: dadosBasicos.dataNascimento || null
      };

      await atualizarCliente(id, updateData);

      // 2. Sincronizar dados da família
      if (conjuge !== undefined || filhos !== undefined) {
        await syncFamiliaData(
          id,
          conjuge || { nome: '', dataNascimento: '' },
          filhos || []
        );
      }

      toast.success('Cliente atualizado com sucesso');
    } catch (error) {
      console.error('❌ Erro ao atualizar cliente completo:', error);
      toast.error('Erro ao atualizar cliente');
      throw error;
    }
  }, [atualizarCliente, syncFamiliaData]);

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

  const getClienteByNome = useCallback((nome: string): ClienteCompleto | undefined => {
    if (!nome?.trim()) return undefined;
    const nomeNormalizado = nome.trim().toLowerCase();
    return clientesCompletos.find(c => 
      c.nome?.toLowerCase().trim() === nomeNormalizado
    );
  }, [clientesCompletos]);

  const searchClientes = useCallback((termo: string): ClienteCompleto[] => {
    if (!termo.trim()) return clientesCompletos;
    
    const termoBusca = termo.toLowerCase();
    return clientesCompletos.filter(cliente => 
      cliente.nome?.toLowerCase().includes(termoBusca) ||
      cliente.email?.toLowerCase().includes(termoBusca) ||
      cliente.telefone?.includes(termoBusca) ||
      cliente.whatsapp?.includes(termoBusca)
    );
  }, [clientesCompletos]);

  // ============= MIGRATION HELPER =============
  
  const migrarLocalStorageClientes = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) throw new Error('User not authenticated');
      const user = session.user;

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
    atualizarClienteCompleto,
    verificarClienteTemDados,
    
    // Family operations
    adicionarFamilia,
    atualizarFamilia,
    removerFamilia,
    
    // Utility functions
    getClienteById,
    getClienteByNome,
    searchClientes,
    
    // Migration
    migrarLocalStorageClientes
  };
}