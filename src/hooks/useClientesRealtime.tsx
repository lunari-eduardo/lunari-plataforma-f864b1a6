/**
 * Hook para gerenciar clientes em tempo real via Supabase
 * Substitui completamente o uso de localStorage para clientes
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { Cliente } from '@/types/cliente';
import type { ClienteSupabase } from '@/types/cliente-supabase';

// Converter de Supabase para formato interno
const mapSupabaseToCliente = (supabaseCliente: ClienteSupabase): Cliente => ({
  id: supabaseCliente.id,
  nome: supabaseCliente.nome,
  email: supabaseCliente.email || '',
  telefone: supabaseCliente.telefone,
  whatsapp: supabaseCliente.whatsapp || '',
  endereco: supabaseCliente.endereco || '',
  observacoes: supabaseCliente.observacoes || '',
  origem: supabaseCliente.origem || '',
  dataNascimento: supabaseCliente.data_nascimento || '',
  dataUltimoContato: supabaseCliente.created_at || new Date().toISOString()
});

// Converter de formato interno para Supabase
const mapClienteToSupabase = (cliente: Omit<Cliente, 'id'>): Omit<ClienteSupabase, 'id' | 'user_id' | 'created_at' | 'updated_at'> => ({
  nome: cliente.nome,
  email: cliente.email || null,
  telefone: cliente.telefone,
  whatsapp: cliente.whatsapp || null,
  endereco: cliente.endereco || null,
  observacoes: cliente.observacoes || null,
  origem: cliente.origem || null,
  data_nascimento: cliente.dataNascimento || null
});

interface ClientesRealtimeState {
  clientes: Cliente[];
  isLoading: boolean;
  error: string | null;
}

export const useClientesRealtime = () => {
  const [state, setState] = useState<ClientesRealtimeState>({
    clientes: [],
    isLoading: true,
    error: null
  });

  // ============= CARREGAR DADOS INICIAIS =============
  
  const loadClientes = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));
      
      const { data, error } = await supabase
        .from('clientes')
        .select('*')
        .order('nome');

      if (error) throw error;

      const clientesMapped = (data || []).map(mapSupabaseToCliente);
      setState(prev => ({ 
        ...prev, 
        clientes: clientesMapped, 
        isLoading: false 
      }));
      
      console.log('✅ Clientes carregados do Supabase:', clientesMapped.length);
    } catch (error) {
      console.error('❌ Erro ao carregar clientes:', error);
      setState(prev => ({ 
        ...prev, 
        isLoading: false, 
        error: error instanceof Error ? error.message : 'Erro desconhecido' 
      }));
    }
  }, []);

  // ============= REAL-TIME SUBSCRIPTIONS =============
  
  useEffect(() => {
    // Carregar dados iniciais
    loadClientes();

    // Setup real-time subscription
    const channel = supabase
      .channel('clientes_realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'clientes'
        },
        (payload) => {
          console.log('Real-time update clientes:', payload);
          
          if (payload.eventType === 'INSERT' && payload.new) {
            const novoCliente = mapSupabaseToCliente(payload.new as ClienteSupabase);
            setState(prev => ({
              ...prev,
              clientes: [...prev.clientes, novoCliente]
            }));
          }
          
          if (payload.eventType === 'UPDATE' && payload.new) {
            const clienteAtualizado = mapSupabaseToCliente(payload.new as ClienteSupabase);
            setState(prev => ({
              ...prev,
              clientes: prev.clientes.map(c => 
                c.id === clienteAtualizado.id ? clienteAtualizado : c
              )
            }));
          }
          
          if (payload.eventType === 'DELETE' && payload.old) {
            setState(prev => ({
              ...prev,
              clientes: prev.clientes.filter(c => c.id !== (payload.old as any).id)
            }));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadClientes]);

  // ============= OPERAÇÕES CRUD =============
  
  const adicionarCliente = useCallback(async (clienteData: Omit<Cliente, 'id'>) => {
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error('Usuário não autenticado');

      const supabaseData = mapClienteToSupabase(clienteData);
      
      const { data, error } = await supabase
        .from('clientes')
        .insert({
          ...supabaseData,
          user_id: user.user.id
        })
        .select()
        .single();

      if (error) throw error;

      const novoCliente = mapSupabaseToCliente(data);
      toast.success('Cliente adicionado com sucesso');
      
      return novoCliente;
    } catch (error) {
      console.error('❌ Erro ao adicionar cliente:', error);
      toast.error('Erro ao adicionar cliente');
      throw error;
    }
  }, []);

  const atualizarCliente = useCallback(async (id: string, updates: Partial<Cliente>) => {
    try {
      const supabaseUpdates = mapClienteToSupabase(updates as Cliente);
      
      const { error } = await supabase
        .from('clientes')
        .update(supabaseUpdates)
        .eq('id', id);

      if (error) throw error;
      
      toast.success('Cliente atualizado com sucesso');
    } catch (error) {
      console.error('❌ Erro ao atualizar cliente:', error);
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
      console.error('❌ Erro ao remover cliente:', error);
      toast.error('Erro ao remover cliente');
      throw error;
    }
  }, []);

  const verificarClienteTemDados = useCallback(async (id: string): Promise<{
    temDados: boolean;
    sessoes: number;
    pagamentos: number;
  }> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

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

  return {
    clientes: state.clientes,
    isLoading: state.isLoading,
    error: state.error,
    adicionarCliente,
    atualizarCliente,
    removerCliente,
    verificarClienteTemDados,
    reloadClientes: loadClientes
  };
};