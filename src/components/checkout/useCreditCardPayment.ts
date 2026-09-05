import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { loadMercadoPagoSdk } from '@/utils/mercadopagoSdk';
import type { AsaasCheckoutData, PayerHintsPrefill } from './types';
import { validateCpfCnpj } from './checkoutValidation';

const SUPABASE_URL = 'https://tlnjspsywycbudhewsfv.supabase.co';

interface UseCreditCardPaymentParams {
  data: AsaasCheckoutData;
  payerHints?: PayerHintsPrefill;
  initialFullName: string;
  cardName: string;
  cardCpfCnpj: string;
  cardNumber: string;
  cardExpiry: string;
  cardCvv: string;
  cardPhone: string;
  cardEmail: string;
  cardCep: string;
  cardInstallments: string;
  valorComTaxas: number;
  repassarAntecipacao: boolean;
  onPaymentSuccess: () => void;
  setCardSuccess: (v: boolean) => void;
  setCardProcessing: (v: boolean) => void;
}

export function useCreditCardPayment({
  data,
  payerHints,
  initialFullName,
  cardName,
  cardCpfCnpj,
  cardNumber,
  cardExpiry,
  cardCvv,
  cardPhone,
  cardEmail,
  cardCep,
  cardInstallments,
  valorComTaxas,
  repassarAntecipacao,
  onPaymentSuccess,
  setCardSuccess,
  setCardProcessing,
}: UseCreditCardPaymentParams) {
  const [cardLoading, setCardLoading] = useState(false);
  const [cardError, setCardError] = useState<string | null>(null);

  const handleCardSubmit = async () => {
    setCardError(null);

    if (!cardName.trim()) {
      setCardError('Informe o nome no cartão');
      return;
    }
    if (!validateCpfCnpj(cardCpfCnpj)) {
      setCardError('CPF/CNPJ inválido');
      return;
    }
    const rawCard = cardNumber.replace(/\s/g, '');
    if (rawCard.length < 13) {
      setCardError('Número do cartão inválido');
      return;
    }
    const [expM, expY] = cardExpiry.split('/');
    if (!expM || !expY || parseInt(expM) < 1 || parseInt(expM) > 12) {
      setCardError('Validade inválida');
      return;
    }
    if (cardCvv.length < 3) {
      setCardError('CVV inválido');
      return;
    }
    if (!cardEmail || !/\S+@\S+\.\S+/.test(cardEmail)) {
      setCardError('Informe o email do titular do cartão');
      return;
    }
    if (cardPhone.replace(/\D/g, '').length < 10) {
      setCardError('Telefone inválido');
      return;
    }
    if (cardCep.replace(/\D/g, '').length < 8) {
      setCardError('CEP inválido');
      return;
    }

    setCardLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (sessionData?.session?.access_token) {
        headers['Authorization'] = `Bearer ${sessionData.session.access_token}`;
      }

      let result;
      let res;

      const creditCardPayload = {
        holderName: cardName,
        number: rawCard,
        expiryMonth: expM,
        expiryYear: expY.length === 2 ? `20${expY}` : expY,
        ccv: cardCvv,
      };
      const creditCardHolderInfoPayload = {
        name: cardName,
        cpfCnpj: cardCpfCnpj.replace(/\D/g, ''),
        email: cardEmail,
        phone: cardPhone.replace(/\D/g, ''),
        postalCode: cardCep.replace(/\D/g, ''),
        addressNumber: 'S/N',
      };

      let cardToken: string | undefined;
      let paymentMethodId: string | undefined;

      if (data.provedor === 'mercadopago') {
        if (!data.mpPublicKey) {
          throw new Error('Chave pública do Mercado Pago não encontrada.');
        }
        await loadMercadoPagoSdk();
        if (!(window as any).MercadoPago) {
          throw new Error(
            'Falha ao carregar SDK de pagamento. Recarregue a página.',
          );
        }
        const mp = new (window as any).MercadoPago(data.mpPublicKey, {
          locale: 'pt-BR',
        });

        try {
          const bin = rawCard.substring(0, 6);
          if (bin.length >= 6) {
            try {
              const pmResult = await mp.getPaymentMethods({ bin });
              if (pmResult?.results?.[0]?.id) {
                paymentMethodId = pmResult.results[0].id;
              }
            } catch (pmErr) {
              console.warn('[mercadopago] getPaymentMethods fallback:', pmErr);
            }
          }

          const tokenResult = await mp.createCardToken({
            cardNumber: rawCard,
            cardholderName: cardName.toUpperCase(),
            cardExpirationMonth: expM.padStart(2, '0'),
            cardExpirationYear: `20${expY}`,
            securityCode: cardCvv,
            identificationType:
              cardCpfCnpj.replace(/\D/g, '').length === 11 ? 'CPF' : 'CNPJ',
            identificationNumber: cardCpfCnpj.replace(/\D/g, ''),
          });

          if ('cause' in tokenResult && tokenResult.cause?.length > 0) {
            throw new Error(
              tokenResult.cause[0]?.description || 'Erro ao processar cartão',
            );
          }
          if ('id' in tokenResult) {
            cardToken = tokenResult.id;
          }
        } catch (e: any) {
          throw new Error(
            e.message || 'Erro ao tokenizar cartão. Verifique os dados.',
          );
        }
      }

      const payerContactPayload = {
        name: payerHints?.fullName || initialFullName || undefined,
        cpfCnpj: cardCpfCnpj.replace(/\D/g, ''),
        email: cardEmail.trim(),
        phone: cardPhone.replace(/\D/g, ''),
      };

      if (data.cobrancaId) {
        res = await fetch(
          `${SUPABASE_URL}/functions/v1/checkout-process-payment`,
          {
            method: 'POST',
            headers,
            body: JSON.stringify({
              cobrancaId: data.cobrancaId,
              billingType: 'CREDIT_CARD',
              payerContact: payerContactPayload,
              creditCard: creditCardPayload,
              cardToken,
              paymentMethodId,
              creditCardHolderInfo: creditCardHolderInfoPayload,
              installmentCount: parseInt(cardInstallments),
            }),
          },
        );
        result = await res.json();
      } else {
        res = await fetch(`${SUPABASE_URL}/functions/v1/create-cobranca`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            userId: data.userId,
            clienteId: data.clienteId,
            sessionId: data.sessionId,
            valor: valorComTaxas,
            descricao: data.descricao,
            galeriaId: data.galeriaId,
            qtdFotos: data.qtdFotos,
            finalidade: data.finalidade || 'fotos_extras',
            provedor: data.provedor || 'asaas',
            billingType: 'CREDIT_CARD',
            installmentCount: parseInt(cardInstallments),
            payerContact: payerContactPayload,
            creditCard: creditCardPayload,
            cardToken,
            paymentMethodId,
            creditCardHolderInfo: creditCardHolderInfoPayload,
            dadosExtras: {
              valorBase: data.valorTotal,
              repassarTaxasProcessamento: !data.absorverTaxa,
              repassarTaxaAntecipacao: repassarAntecipacao,
            },
          }),
        });
        result = await res.json();
      }

      if (!res.ok || !result.success) {
        throw new Error(result.error || 'Pagamento recusado');
      }

      if (result.paid || result.status === 'pago') {
        setCardSuccess(true);
        onPaymentSuccess();
      } else if (
        (result.requiresPolling ||
          result.creditCardStatus === 'AWAITING_RISK_ANALYSIS') &&
        (result.cobrancaId || data.cobrancaId)
      ) {
        setCardLoading(true);
        const cobrancaId = result.cobrancaId || data.cobrancaId;
        const pollStart = Date.now();
        const maxPollTime = 2 * 60 * 1000;
        const pollInterval = 12000;

        const poll = async () => {
          try {
            const pollRes = await fetch(
              `${SUPABASE_URL}/functions/v1/check-payment-status`,
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ cobrancaId }),
              },
            );
            const pollData = await pollRes.json();

            if (pollData.status === 'pago') {
              setCardSuccess(true);
              setCardLoading(false);
              onPaymentSuccess();
              return;
            }

            if (Date.now() - pollStart < maxPollTime) {
              setTimeout(poll, pollInterval);
            } else {
              setCardLoading(false);
              setCardProcessing(true);
            }
          } catch {
            if (Date.now() - pollStart < maxPollTime) {
              setTimeout(poll, pollInterval);
            } else {
              setCardLoading(false);
              setCardProcessing(true);
            }
          }
        };

        poll();
      } else if (
        result.creditCardStatus === 'CONFIRMED' ||
        result.creditCardStatus === 'RECEIVED'
      ) {
        setCardSuccess(true);
        onPaymentSuccess();
      } else {
        throw new Error('Pagamento não foi aprovado. Tente outro cartão.');
      }
    } catch (err) {
      setCardError(err instanceof Error ? err.message : 'Erro no pagamento');
    } finally {
      setCardLoading(false);
    }
  };

  return {
    cardLoading,
    cardError,
    handleCardSubmit,
  };
}
