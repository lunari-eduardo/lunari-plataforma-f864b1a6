import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Cobranca, TipoCobranca, CobrancaResponse, CreateCobrancaRequest, ProvedorPagamento } from '@/types/cobranca';
import { toast } from 'sonner';
import { generatePixPayload } from '@/utils/pixUtils';

interface UseCobrancaOptions {
  clienteId?: string;
  sessionId?: string;
}

// Note: Provider detection is now explicit via request.provedor
// Gallery uses gallery-create-payment (Service Role) - NOT affected by these changes

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
        provedor: (c.provedor as ProvedorPagamento) || 'mercadopago',
        // Mercado Pago fields
        mpPaymentId: c.mp_payment_id || undefined,
        mpPreferenceId: c.mp_preference_id || undefined,
        mpQrCode: c.mp_qr_code || undefined,
        mpQrCodeBase64: c.mp_qr_code_base64 || undefined,
        mpPixCopiaCola: c.mp_pix_copia_cola || undefined,
        mpPaymentLink: c.mp_payment_link || undefined,
        mpExpirationDate: c.mp_expiration_date || undefined,
        // InfinitePay fields
        ipCheckoutUrl: c.ip_checkout_url || undefined,
        ipOrderNsu: c.ip_order_nsu || undefined,
        ipTransactionNsu: c.ip_transaction_nsu || undefined,
        ipReceiptUrl: c.ip_receipt_url || undefined,
        // Common fields
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

  // Create Pix charge (Mercado Pago only) - kept for legacy/history viewing
  const createPixCharge = async (request: CreateCobrancaRequest): Promise<CobrancaResponse> => {
    setCreatingCharge(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      // PIX generation is now done via checkout link (MP checkout includes PIX option)
      // This function is kept for backward compatibility

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

  // Create payment link (routes to correct provider based on explicit provedor param)
  const createLinkCharge = async (request: CreateCobrancaRequest, installments?: number): Promise<CobrancaResponse> => {
    setCreatingCharge(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      // Provider comes from the modal selection, NOT auto-detected
      const provedor = request.provedor;
      
      if (!provedor || provedor === 'pix_manual') {
        throw new Error('Selecione um provedor de pagamento válido');
      }

      let response;
      
      if (provedor === 'infinitepay') {
        // Use Gestão-specific InfinitePay function (isolated from Gallery)
        response = await supabase.functions.invoke('gestao-infinitepay-create-link', {
          body: {
            clienteId: request.clienteId,
            sessionId: request.sessionId,
            valor: request.valor,
            descricao: request.descricao,
          },
        });
      } else {
        // Use Mercado Pago
        response = await supabase.functions.invoke('mercadopago-create-link', {
          body: {
            clienteId: request.clienteId,
            sessionId: request.sessionId,
            valor: request.valor,
            descricao: request.descricao,
            installments,
          },
        });
      }

      if (response.error) throw response.error;
      
      const result = response.data as CobrancaResponse;
      
      if (result.success) {
        toast.success('Link de pagamento gerado!');
        await fetchCobrancas();
      } else {
        throw new Error(result.error || 'Failed to create link');
      }
      
      // Normalize the response to always have both checkoutUrl and paymentLink
      const normalizedUrl = result.checkoutUrl || result.paymentLink;
      return {
        ...result,
        provedor,
        checkoutUrl: normalizedUrl,
        paymentLink: normalizedUrl,
      };
    } catch (error: any) {
      console.error('Error creating link:', error);
      toast.error(error.message || 'Erro ao gerar link');
      return { success: false, error: error.message };
    } finally {
      setCreatingCharge(false);
    }
  };

  // Create PIX Manual charge locally (no Edge Function)
  const createPixManualCharge = async (request: CreateCobrancaRequest): Promise<CobrancaResponse> => {
    setCreatingCharge(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Fetch PIX Manual configuration from user's integrations
      const { data: integracao, error: integError } = await supabase
        .from('usuarios_integracoes')
        .select('dados_extras')
        .eq('user_id', user.id)
        .eq('provedor', 'pix_manual')
        .eq('status', 'ativo')
        .single();

      if (integError || !integracao?.dados_extras) {
        throw new Error('PIX Manual não configurado. Configure nas Integrações.');
      }

      const dadosExtras = integracao.dados_extras as {
        chavePix: string;
        nomeTitular: string;
      };

      if (!dadosExtras.chavePix || !dadosExtras.nomeTitular) {
        throw new Error('Configuração PIX incompleta. Verifique a chave e nome do titular.');
      }

      // Generate PIX EMV payload locally
      const pixPayload = generatePixPayload({
        chavePix: dadosExtras.chavePix,
        nomeBeneficiario: dadosExtras.nomeTitular,
        valor: request.valor,
        identificador: request.sessionId?.substring(0, 20) || '***',
      });

      // Save charge to database
      const { data: cobranca, error } = await supabase
        .from('cobrancas')
        .insert({
          user_id: user.id,
          cliente_id: request.clienteId,
          session_id: request.sessionId || null,
          valor: request.valor,
          descricao: request.descricao || null,
          tipo_cobranca: 'pix',
          provedor: 'pix_manual',
          status: 'pendente',
          mp_pix_copia_cola: pixPayload, // Reuse existing field
        })
        .select()
        .single();

      if (error) throw error;

      toast.success('PIX gerado com sucesso!');
      await fetchCobrancas();

      const mappedCobranca: Cobranca = {
        id: cobranca.id,
        userId: cobranca.user_id,
        clienteId: cobranca.cliente_id,
        sessionId: cobranca.session_id || undefined,
        valor: cobranca.valor,
        descricao: cobranca.descricao || undefined,
        tipoCobranca: cobranca.tipo_cobranca as TipoCobranca,
        status: cobranca.status as Cobranca['status'],
        provedor: 'pix_manual',
        mpPixCopiaCola: pixPayload,
        createdAt: cobranca.created_at,
        updatedAt: cobranca.updated_at,
      };

      return {
        success: true,
        cobranca: mappedCobranca,
        pixPayload,
        provedor: 'pix_manual',
      };
    } catch (error: any) {
      console.error('Error creating PIX Manual:', error);
      toast.error(error.message || 'Erro ao gerar PIX');
      return { success: false, error: error.message };
    } finally {
      setCreatingCharge(false);
    }
  };

  // Confirm PIX Manual payment manually
  const confirmPixManualPayment = async (chargeId: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('cobrancas')
        .update({ 
          status: 'pago', 
          data_pagamento: new Date().toISOString(),
          updated_at: new Date().toISOString() 
        })
        .eq('id', chargeId);

      if (error) throw error;

      toast.success('Pagamento confirmado!');
      await fetchCobrancas();
      return true;
    } catch (error: any) {
      console.error('Error confirming payment:', error);
      toast.error('Erro ao confirmar pagamento');
      return false;
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

  // Check payment status manually (fallback when webhook fails)
  const checkPaymentStatus = useCallback(async (cobrancaId: string): Promise<{ updated: boolean; status?: string }> => {
    try {
      const response = await supabase.functions.invoke('check-payment-status', {
        body: { cobrancaId, forceUpdate: true },
      });

      if (response.error) throw response.error;

      const result = response.data;

      if (result?.updated) {
        toast.success('Pagamento confirmado!');
        await fetchCobrancas();
        return { updated: true, status: result.status };
      } else if (result?.status === 'pago') {
        toast.info('Pagamento já estava confirmado');
        await fetchCobrancas();
        return { updated: false, status: 'pago' };
      } else {
        toast.info('Pagamento ainda não confirmado');
        return { updated: false, status: result?.status };
      }
    } catch (error: any) {
      console.error('Error checking payment status:', error);
      toast.error('Erro ao verificar status');
      return { updated: false };
    }
  }, [fetchCobrancas]);

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
    createPixManualCharge,
    confirmPixManualPayment,
    cancelCharge,
    checkPaymentStatus,
    refetch: fetchCobrancas,
  };
}
