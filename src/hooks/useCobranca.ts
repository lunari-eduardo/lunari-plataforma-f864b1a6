import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Cobranca, TipoCobranca, CobrancaResponse, CreateCobrancaRequest, ProvedorPagamento } from '@/types/cobranca';
import { toast } from 'sonner';
import { buildPaymentShareUrl } from '@/utils/domainUtils';

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
        tipoCobranca: (c.tipo_cobranca as TipoCobranca) || 'link',
        status: (c.status as Cobranca['status']) || 'pendente',
        provedor: (c.provedor as ProvedorPagamento) || 'mercadopago',
        // Mercado Pago fields
        mpPaymentId: c.mp_payment_id || c.provider_transaction_id || undefined,
        mpPreferenceId: c.mp_preference_id || c.provider_order_id || undefined,
        mpQrCode: c.mp_qr_code || undefined,
        mpQrCodeBase64: c.mp_qr_code_base64 || c.pix_qr_code_base64 || undefined,
        mpPixCopiaCola: c.mp_pix_copia_cola || c.pix_copia_cola || undefined,
        mpPaymentLink: c.mp_payment_link || c.checkout_url || undefined,
        mpExpirationDate: c.mp_expiration_date || undefined,
        // InfinitePay fields
        ipCheckoutUrl: c.ip_checkout_url || c.checkout_url || undefined,
        ipOrderNsu: c.ip_order_nsu || c.id,
        ipTransactionNsu: c.ip_transaction_nsu || c.provider_transaction_id || undefined,
        ipReceiptUrl: c.ip_receipt_url || undefined,
        // Common fields
        dataPagamento: c.data_pagamento || undefined,
        valorLiquido: (c as any).valor_liquido || undefined,
        createdAt: c.created_at,
        updatedAt: c.updated_at,
        // Installment fields
        totalParcelas: (c as any).total_parcelas || undefined,
        parcelasPagas: (c as any).parcelas_pagas || undefined,
        asaasInstallmentId: (c as any).asaas_installment_id || undefined,
      }));

      setCobrancas(mappedCobrancas);
    } catch (error) {
      console.error('Error fetching cobrancas:', error);
    } finally {
      setLoading(false);
    }
  }, [options.clienteId, options.sessionId]);

  // Create Pix charge (delegates to unified create-cobranca)
  const createPixCharge = async (request: CreateCobrancaRequest): Promise<CobrancaResponse> => {
    setCreatingCharge(true);
    try {
      const provedor = request.provedor || 'mercadopago';
      const correlationId = request.correlationId || crypto.randomUUID();
      const idempotencyKey = crypto.randomUUID();

      const response = await supabase.functions.invoke('create-cobranca', {
        body: {
          clienteId: request.clienteId,
          sessionId: request.sessionId,
          galeriaId: request.galeriaId,
          valor: request.valor,
          descricao: request.descricao,
          provedor,
          finalidade: request.finalidade || 'sessao',
          qtdFotos: request.qtdFotos,
          snapshotFotosIncluidas: request.snapshotFotosIncluidas,
          valorSessaoComponente: request.valorSessaoComponente,
          valorExtrasComponente: request.valorExtrasComponente,
          billingType: 'PIX',
          correlationId,
          idempotencyKey,
          dadosExtras: request.dadosExtras,
        },
      });

      if (response.error) throw response.error;
      const result = response.data as CobrancaResponse;

      if (result.success) {
        toast.success('Pix gerado com sucesso!');
        await fetchCobrancas();
      } else {
        throw new Error(result.error || 'Falha ao gerar Pix');
      }

      const rawUrl = result.checkoutUrl || result.paymentLink;
      const shareUrl = result.cobrancaId ? buildPaymentShareUrl(result.cobrancaId) : rawUrl;

      return {
        ...result,
        provedor,
        checkoutUrl: shareUrl,
        paymentLink: shareUrl,
      };
    } catch (error: any) {
      console.error('Error creating Pix:', error);
      toast.error(error.message || 'Erro ao gerar Pix');
      return { success: false, error: error.message };
    } finally {
      setCreatingCharge(false);
    }
  };

  // Create payment link (routes directly to unified create-cobranca orchestrator)
  const createLinkCharge = async (request: CreateCobrancaRequest, installments?: number): Promise<CobrancaResponse> => {
    setCreatingCharge(true);
    try {
      const provedor = request.provedor;
      
      if (!provedor) {
        throw new Error('Selecione um provedor de pagamento válido');
      }

      const correlationId = request.correlationId || crypto.randomUUID();
      const idempotencyKey = crypto.randomUUID();

      const requestBody = {
        clienteId: request.clienteId,
        sessionId: request.sessionId,
        galeriaId: request.galeriaId,
        valor: request.valor,
        descricao: request.descricao,
        finalidade: request.finalidade || 'sessao',
        qtdFotos: request.qtdFotos,
        snapshotFotosIncluidas: request.snapshotFotosIncluidas,
        correlationId,
        valorSessaoComponente: request.valorSessaoComponente,
        valorExtrasComponente: request.valorExtrasComponente,
        provedor,
        installmentCount: installments,
        idempotencyKey,
        dadosExtras: request.dadosExtras,
      };

      const response = await supabase.functions.invoke('create-cobranca', {
        body: requestBody,
      });

      if (response.error) throw response.error;
      const result = response.data as CobrancaResponse;

      if (result.success) {
        toast.success('Link de pagamento gerado!');
        await fetchCobrancas();
      } else {
        throw new Error(result.error || 'Falha ao gerar link de pagamento');
      }

      const rawUrl = result.checkoutUrl || result.paymentLink;
      const shareUrl = result.cobrancaId ? buildPaymentShareUrl(result.cobrancaId) : rawUrl;

      return {
        ...result,
        provedor,
        checkoutUrl: shareUrl,
        paymentLink: shareUrl,
      };
    } catch (error: any) {
      console.error('Error creating link:', error);
      toast.error(error.message || 'Erro ao gerar link');
      return { success: false, error: error.message };
    } finally {
      setCreatingCharge(false);
    }
  };

  // Create PIX Manual charge via unified orchestrator
  const createPixManualCharge = async (request: CreateCobrancaRequest): Promise<CobrancaResponse> => {
    setCreatingCharge(true);
    try {
      const correlationId = request.correlationId || crypto.randomUUID();
      const idempotencyKey = crypto.randomUUID();

      const requestBody = {
        clienteId: request.clienteId,
        sessionId: request.sessionId,
        galeriaId: request.galeriaId,
        valor: request.valor,
        descricao: request.descricao,
        finalidade: request.finalidade || 'sessao',
        qtdFotos: request.qtdFotos,
        snapshotFotosIncluidas: request.snapshotFotosIncluidas,
        correlationId,
        valorSessaoComponente: request.valorSessaoComponente,
        valorExtrasComponente: request.valorExtrasComponente,
        provedor: 'pix_manual' as ProvedorPagamento,
        idempotencyKey,
      };

      const response = await supabase.functions.invoke('create-cobranca', {
        body: requestBody,
      });

      if (response.error) throw response.error;
      const result = response.data as CobrancaResponse;

      if (result.success) {
        toast.success('PIX gerado com sucesso!');
        await fetchCobrancas();
      } else {
        throw new Error(result.error || 'Falha ao gerar PIX Manual');
      }

      const rawUrl = result.checkoutUrl || result.paymentLink;
      const shareUrl = result.cobrancaId ? buildPaymentShareUrl(result.cobrancaId) : rawUrl;

      return {
        ...result,
        provedor: 'pix_manual',
        checkoutUrl: shareUrl,
        paymentLink: shareUrl,
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
        body: { cobrancaId, forceUpdate: false },
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

  // Real-time subscription (filtrado por user_id — evita leak multi-tenant)
  useEffect(() => {
    if (!options.clienteId && !options.sessionId) return;

    fetchCobrancas();

    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;

    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || cancelled) return;

      const channelId = crypto.randomUUID();
      channel = supabase
        .channel(`cobrancas-${user.id}-${channelId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'cobrancas',
            filter: `user_id=eq.${user.id}`,
          },
          () => {
            fetchCobrancas();
          }
        )
        .subscribe();
    })();

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, [options.clienteId, options.sessionId, fetchCobrancas]);

  // Create Asaas Pix charge helper
  const createAsaasPixCharge = async (request: CreateCobrancaRequest): Promise<CobrancaResponse> => {
    return createPixCharge({
      ...request,
      provedor: 'asaas',
    });
  };

  return {
    cobrancas,
    loading,
    creatingCharge,
    createPixCharge,
    createAsaasPixCharge,
    createLinkCharge,
    createPixManualCharge,
    confirmPixManualPayment,
    cancelCharge,
    checkPaymentStatus,
    refetch: fetchCobrancas,
  };
}

