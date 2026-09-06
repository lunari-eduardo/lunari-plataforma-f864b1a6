import { supabase } from '@/integrations/supabase/client';
import { SessionPaymentExtended } from '@/types/sessionPayments';

export async function executeGatewayRefund(
  payment: SessionPaymentExtended,
  paymentId: string,
  motivo?: string
): Promise<boolean> {
  if (payment.origem !== 'asaas' && payment.origem !== 'mercadopago') {
    return true;
  }

  try {
    if (payment.origem === 'asaas') {
      let cobrancaId: string | undefined = payment.cobrancaId;
      let parcelaId: string | undefined = payment.parcelaId;

      if (!parcelaId && paymentId.startsWith('asaas-parcela-')) {
        parcelaId = paymentId.replace('asaas-parcela-', '');
      }
      if (!cobrancaId && paymentId.startsWith('asaas-') && !paymentId.startsWith('asaas-parcela-')) {
        cobrancaId = paymentId.replace('asaas-', '');
      }
      if (!cobrancaId && parcelaId) {
        const { data: parcela } = await supabase
          .from('cobranca_parcelas')
          .select('cobranca_id')
          .eq('id', parcelaId)
          .maybeSingle();
        cobrancaId = parcela?.cobranca_id || undefined;
      }
      if (!cobrancaId && /^[0-9a-f-]{36}$/i.test(paymentId)) {
        const { data: trx } = await supabase
          .from('clientes_transacoes')
          .select('cobranca_id')
          .eq('id', paymentId)
          .maybeSingle();
        cobrancaId = (trx as any)?.cobranca_id || undefined;
      }

      if (!cobrancaId) {
        const { toast } = await import('sonner');
        toast.error('Não foi possível identificar a cobrança Asaas para estornar');
        return false;
      }

      const { data, error } = await supabase.functions.invoke('gestao-asaas-refund', {
        body: { cobrancaId, parcelaId, valor: payment.valor, motivo }
      });

      if (error || !data?.success) {
        const { toast } = await import('sonner');
        const errMsg = (data as any)?.error || error?.message || 'Erro ao estornar no Asaas';
        toast.error(`Estorno no Asaas falhou: ${errMsg}`);
        return false;
      }
    } else if (payment.origem === 'mercadopago') {
      const suffix = paymentId.replace(/^mp-/, '');
      const isUUID = /^[0-9a-f-]{36}$/i.test(suffix);
      let cobrancaId: string | undefined = payment.cobrancaId;
      if (!cobrancaId && isUUID) {
        cobrancaId = suffix;
      } else if (!cobrancaId) {
        const { data: cob } = await supabase
          .from('cobrancas')
          .select('id')
          .eq('mp_payment_id', suffix)
          .maybeSingle();
        cobrancaId = cob?.id;
      }

      if (!cobrancaId) {
        const { toast } = await import('sonner');
        toast.error('Não foi possível identificar a cobrança Mercado Pago para estornar');
        return false;
      }

      const { data, error } = await supabase.functions.invoke('gestao-mercadopago-refund', {
        body: { cobrancaId, valor: payment.valor, motivo }
      });

      if (error || !data?.success) {
        const { toast } = await import('sonner');
        const errMsg = (data as any)?.error || error?.message || 'Erro ao estornar no Mercado Pago';
        toast.error(`Estorno no Mercado Pago falhou: ${errMsg}`);
        return false;
      }
    }
    return true;
  } catch (err) {
    console.error('Erro ao chamar gateway refund:', err);
    const { toast } = await import('sonner');
    toast.error('Erro inesperado ao estornar no gateway');
    return false;
  }
}
