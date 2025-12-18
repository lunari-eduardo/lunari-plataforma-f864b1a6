import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Cobranca, TipoCobranca, CobrancaResponse, CreateCobrancaRequest } from '@/types/cobranca';
import { toast } from 'sonner';

interface UseCobrancaOptions {
  clienteId?: string;
  sessionId?: string;
}

export function useCobranca(options: UseCobrancaOptions = {}) {
  const [cobrancas, setCobrancas] = useState<Cobranca[]>([]);
  const [loading, setLoading] = useState(false);
  const [creatingCharge, setCreatingCharge] = useState(false);

  // Fetch charges for client/session
  const fetchCobrancas = useCallback(async () => {
    if (!options.clienteId && !options.sessionId) return;

    setLoading(true);
    try {
      let query = supabase
        .from('cobrancas')
        .select('*')
        .order('created_at', { ascending: false });

      if (options.sessionId) {
        query = query.eq('session_id', options.sessionId);
      } else if (options.clienteId) {
        query = query.eq('cliente_id', options.clienteId);
      }

      const { data, error } = await query;

      if (error) throw error;

      const mappedCobrancas: Cobranca[] = (data || []).map(c => ({
        id: c.id,
        userId: c.user_id,
        clienteId: c.cliente_id,
        sessionId: c.session_id || undefined,
        valor: c.valor,
        descricao: c.descricao || undefined,
        tipoCobranca: c.tipo_cobranca as TipoCobranca,
        status: c.status as Cobranca['status'],
        mpPaymentId: c.mp_payment_id || undefined,
        mpPreferenceId: c.mp_preference_id || undefined,
        mpQrCode: c.mp_qr_code || undefined,
        mpQrCodeBase64: c.mp_qr_code_base64 || undefined,
        mpPixCopiaCola: c.mp_pix_copia_cola || undefined,
        mpPaymentLink: c.mp_payment_link || undefined,
        mpExpirationDate: c.mp_expiration_date || undefined,
        dataPagamento: c.data_pagamento || undefined,
        createdAt: c.created_at,
        updatedAt: c.updated_at,
      }));

      setCobrancas(mappedCobrancas);
    } catch (error) {
      console.error('Error fetching cobrancas:', error);
    } finally {
      setLoading(false);
    }
  }, [options.clienteId, options.sessionId]);

  // Create Pix charge
  const createPixCharge = async (request: CreateCobrancaRequest): Promise<CobrancaResponse> => {
    setCreatingCharge(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await supabase.functions.invoke('mercadopago-create-pix', {
        body: {
          clienteId: request.clienteId,
          sessionId: request.sessionId,
          valor: request.valor,
          descricao: request.descricao,
        },
      });

      if (response.error) throw response.error;
      
      const result = response.data as CobrancaResponse;
      
      if (result.success) {
        toast.success('Pix gerado com sucesso!');
        await fetchCobrancas();
      } else {
        throw new Error(result.error || 'Failed to create Pix');
      }
      
      return result;
    } catch (error: any) {
      console.error('Error creating Pix:', error);
      toast.error(error.message || 'Erro ao gerar Pix');
      return { success: false, error: error.message };
    } finally {
      setCreatingCharge(false);
    }
  };

  // Create payment link
  const createLinkCharge = async (request: CreateCobrancaRequest, installments?: number): Promise<CobrancaResponse> => {
    setCreatingCharge(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await supabase.functions.invoke('mercadopago-create-link', {
        body: {
          clienteId: request.clienteId,
          sessionId: request.sessionId,
          valor: request.valor,
          descricao: request.descricao,
          installments,
        },
      });

      if (response.error) throw response.error;
      
      const result = response.data as CobrancaResponse;
      
      if (result.success) {
        toast.success('Link de pagamento gerado!');
        await fetchCobrancas();
      } else {
        throw new Error(result.error || 'Failed to create link');
      }
      
      return result;
    } catch (error: any) {
      console.error('Error creating link:', error);
      toast.error(error.message || 'Erro ao gerar link');
      return { success: false, error: error.message };
    } finally {
      setCreatingCharge(false);
    }
  };

  // Cancel charge
  const cancelCharge = async (chargeId: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('cobrancas')
        .update({ status: 'cancelado', updated_at: new Date().toISOString() })
        .eq('id', chargeId);

      if (error) throw error;

      toast.success('Cobrança cancelada');
      await fetchCobrancas();
      return true;
    } catch (error: any) {
      console.error('Error canceling charge:', error);
      toast.error('Erro ao cancelar cobrança');
      return false;
    }
  };

  // Real-time subscription
  useEffect(() => {
    if (!options.clienteId && !options.sessionId) return;

    fetchCobrancas();

    const channel = supabase
      .channel('cobrancas-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'cobrancas',
        },
        (payload) => {
          console.log('Cobranca change:', payload);
          fetchCobrancas();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [options.clienteId, options.sessionId, fetchCobrancas]);

  return {
    cobrancas,
    loading,
    creatingCharge,
    createPixCharge,
    createLinkCharge,
    cancelCharge,
    refetch: fetchCobrancas,
  };
}
