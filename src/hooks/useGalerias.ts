import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface Galeria {
  id: string;
  user_id: string;
  cliente_id: string;
  session_id: string | null;
  orcamento_id: string | null;
  fotos_incluidas: number;
  valor_foto_extra: number;
  regras_selecao: Record<string, any>;
  prazo_selecao_dias: number;
  status: 'rascunho' | 'publicada' | 'em_selecao' | 'finalizada';
  status_pagamento: 'sem_vendas' | 'pendente' | 'pago';
  created_at: string;
  updated_at: string;
  published_at: string | null;
  finalized_at: string | null;
  total_fotos_extras_vendidas: number;
  valor_total_vendido: number;
}

export interface CreateGaleriaData {
  cliente_id: string;
  session_id?: string;
  orcamento_id?: string;
  fotos_incluidas: number;
  valor_foto_extra: number;
  regras_selecao?: Record<string, any>;
  prazo_selecao_dias?: number;
}

export function useGalerias() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);

  const createGaleria = useCallback(async (data: CreateGaleriaData): Promise<Galeria | null> => {
    if (!user?.id) {
      toast.error('Usuário não autenticado');
      return null;
    }

    try {
      setLoading(true);

      const galeriaData = {
        user_id: user.id,
        cliente_id: data.cliente_id,
        session_id: data.session_id || null,
        orcamento_id: data.orcamento_id || null,
        fotos_incluidas: data.fotos_incluidas,
        valor_foto_extra: data.valor_foto_extra,
        regras_selecao: data.regras_selecao || {},
        prazo_selecao_dias: data.prazo_selecao_dias || 7,
        status: 'rascunho' as const,
        status_pagamento: 'sem_vendas' as const,
      };

      const { data: galeria, error } = await supabase
        .from('galerias')
        .insert(galeriaData)
        .select()
        .single();

      if (error) {
        console.error('Error creating galeria:', error);
        toast.error('Erro ao criar galeria');
        return null;
      }

      // Atualizar clientes_sessoes com galeria_id se session_id foi fornecido
      if (data.session_id && galeria) {
        await supabase
          .from('clientes_sessoes')
          .update({ galeria_id: galeria.id })
          .eq('session_id', data.session_id)
          .eq('user_id', user.id);
      }

      toast.success('Galeria criada com sucesso!');
      return galeria as unknown as Galeria;
    } catch (error) {
      console.error('Exception creating galeria:', error);
      toast.error('Erro ao criar galeria');
      return null;
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  const getGaleriaBySessionId = useCallback(async (sessionId: string): Promise<Galeria | null> => {
    if (!user?.id) return null;

    try {
      const { data, error } = await supabase
        .from('galerias')
        .select('*')
        .eq('session_id', sessionId)
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) {
        console.error('Error fetching galeria:', error);
        return null;
      }

      return data as unknown as Galeria;
    } catch (error) {
      console.error('Exception fetching galeria:', error);
      return null;
    }
  }, [user?.id]);

  const getGaleriasByClienteId = useCallback(async (clienteId: string): Promise<Galeria[]> => {
    if (!user?.id) return [];

    try {
      const { data, error } = await supabase
        .from('galerias')
        .select('*')
        .eq('cliente_id', clienteId)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching galerias:', error);
        return [];
      }

      return (data || []) as unknown as Galeria[];
    } catch (error) {
      console.error('Exception fetching galerias:', error);
      return [];
    }
  }, [user?.id]);

  const updateGaleriaStatus = useCallback(async (
    galeriaId: string, 
    status: Galeria['status']
  ): Promise<boolean> => {
    if (!user?.id) {
      toast.error('Usuário não autenticado');
      return false;
    }

    try {
      setLoading(true);

      const updateData: Record<string, any> = { status };
      
      // Adicionar timestamps específicos por status
      if (status === 'publicada') {
        updateData.published_at = new Date().toISOString();
      } else if (status === 'finalizada') {
        updateData.finalized_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from('galerias')
        .update(updateData)
        .eq('id', galeriaId)
        .eq('user_id', user.id);

      if (error) {
        console.error('Error updating galeria status:', error);
        toast.error('Erro ao atualizar status da galeria');
        return false;
      }

      toast.success('Status da galeria atualizado');
      return true;
    } catch (error) {
      console.error('Exception updating galeria status:', error);
      toast.error('Erro ao atualizar status da galeria');
      return false;
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  const deleteGaleria = useCallback(async (galeriaId: string): Promise<boolean> => {
    if (!user?.id) {
      toast.error('Usuário não autenticado');
      return false;
    }

    try {
      setLoading(true);

      const { error } = await supabase
        .from('galerias')
        .delete()
        .eq('id', galeriaId)
        .eq('user_id', user.id);

      if (error) {
        console.error('Error deleting galeria:', error);
        toast.error('Erro ao excluir galeria');
        return false;
      }

      toast.success('Galeria excluída');
      return true;
    } catch (error) {
      console.error('Exception deleting galeria:', error);
      toast.error('Erro ao excluir galeria');
      return false;
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  return {
    loading,
    createGaleria,
    getGaleriaBySessionId,
    getGaleriasByClienteId,
    updateGaleriaStatus,
    deleteGaleria,
  };
}
