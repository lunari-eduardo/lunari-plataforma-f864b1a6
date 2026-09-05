import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Gallery, GalleryPhoto } from '@/types/gallery';
import { AsaasCheckoutData } from '@/components/AsaasCheckout';
import { ContactCollectionMissing } from '@/components/ContactCollectionModal';
import { hintsAreComplete } from '@/lib/payerHintsValidation';
import { calcularPrecoProgressivoComCredito, RegrasCongeladas } from '@/lib/pricingUtils';
import { SelectionStep, SUPABASE_URL, SUPABASE_ANON_KEY, PendingConfirmPayload, PaymentInfo, PixPaymentData } from '../types';

interface UseClientGalleryConfirmationProps {
  identifier?: string;
  galleryId: string | null | undefined;
  sessionId: string | null | undefined;
  visitorId: string | null;
  gallery: Gallery | null;
  galleryResponse: any;
  localPhotos: GalleryPhoto[];
  regrasCongeladas: RegrasCongeladas | null;
  extrasPagasTotal: number;
  valorJaPago: number;
  extrasACobrar: number;
  refetchGallery: () => Promise<any>;
}

export function useClientGalleryConfirmation({
  identifier,
  galleryId,
  sessionId,
  visitorId,
  gallery,
  galleryResponse,
  localPhotos,
  regrasCongeladas,
  extrasPagasTotal,
  valorJaPago,
  extrasACobrar,
  refetchGallery,
}: UseClientGalleryConfirmationProps) {
  const [currentStep, setCurrentStep] = useState<SelectionStep>('gallery');
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [showPartialSelectionDialog, setShowPartialSelectionDialog] = useState(false);
  const [contactModalOpen, setContactModalOpen] = useState(false);
  const [forcedMissing, setForcedMissing] = useState<Partial<ContactCollectionMissing> | null>(null);
  const [pendingConfirmPayload, setPendingConfirmPayload] = useState<PendingConfirmPayload | null>(null);
  const [preCheckoutExternalErrors, setPreCheckoutExternalErrors] = useState<
    Partial<Record<'nome' | 'email' | 'phone' | 'cpfCnpj', string>>
  >({});

  // Payment states
  const [paymentInfo, setPaymentInfo] = useState<PaymentInfo | null>(null);
  const [pixPaymentData, setPixPaymentData] = useState<PixPaymentData | null>(null);
  const [asaasCheckoutData, setAsaasCheckoutData] = useState<AsaasCheckoutData | null>(null);
  const [isRedirectingToCheckout, setIsRedirectingToCheckout] = useState(false);

  // Mutation for confirming selection via Edge Function
  const confirmMutation = useMutation({
    mutationFn: async (pricingData: { 
      selectedCount: number; 
      extraCount: number; 
      valorUnitario: number; 
      valorTotal: number;
      payer?: { nome?: string; email?: string; phone?: string; cpfCnpj?: string };
    }) => {
      const saleMode = gallery?.saleSettings?.mode;
      const shouldRequestPayment = saleMode === 'sale_with_payment' && pricingData.valorTotal > 0;
      
      const response = await fetch(`${SUPABASE_URL}/functions/v1/confirm-selection`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ 
          galleryToken: identifier,
          selectedCount: pricingData.selectedCount,
          extraCount: pricingData.extraCount,
          valorUnitario: pricingData.valorUnitario,
          valorTotal: pricingData.valorTotal,
          requestPayment: shouldRequestPayment,
          visitorId: visitorId || undefined,
          payer: pricingData.payer,
        }),
      });
      
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        if (response.status === 409 || error?.code === 'ALREADY_PROCESSING' || error?.code === 'ALREADY_FINALIZED') {
          await refetchGallery();
          const err = new Error('ALREADY_FINALIZED') as Error & { silent?: boolean };
          err.silent = true;
          throw err;
        }
        throw new Error(error.error || 'Erro ao confirmar seleção');
      }

      return response.json();
    },
    onSuccess: async (data) => {
      // PIX Manual - show internal payment screen
      if (data.requiresPayment && data.paymentMethod === 'pix_manual' && data.pixData) {
        setPixPaymentData({
          chavePix: data.pixData.chavePix || '',
          nomeTitular: data.pixData.nomeTitular || '',
          tipoChave: data.pixData.tipoChave,
          valorTotal: data.valorTotal || 0,
        });
        setCurrentStep('payment');
        return;
      }
      
      // Asaas transparent checkout - show inline payment form
      if (data.requiresPayment && data.transparentCheckout && data.asaasCheckoutData) {
        setAsaasCheckoutData(data.asaasCheckoutData as AsaasCheckoutData);
        setCurrentStep('payment');
        return;
      }

      // Checkout externo (InfinitePay/MercadoPago) - redirect immediately
      const effectiveCheckoutUrl = data.checkoutUrl || (data as any)?.data?.checkoutUrl || (data as any)?.url || (data as any)?.paymentLink;
      if (data.requiresPayment && effectiveCheckoutUrl) {
        console.log('💳 Redirecionando para checkout externo:', effectiveCheckoutUrl);
        try {
          sessionStorage.setItem(`gallery_checkout_pending_${identifier}`, JSON.stringify({
            cobrancaId: data.cobrancaId ?? null,
            provedor: data.provedor ?? 'externo',
            valorTotal: data.valorTotal ?? 0,
            timestamp: Date.now(),
          }));
        } catch { /* ignore quota */ }
        setIsRedirectingToCheckout(true);
        requestAnimationFrame(() => {
          window.location.replace(effectiveCheckoutUrl);
        });
        return;
      }
      
      if (data.requiresPayment) {
        console.warn('⚠️ Backend indicated requiresPayment=true, sincronizando estado da galeria...', data);
        await refetchGallery();
        return;
      }
      
      const expectsPayment = gallery?.saleSettings?.mode === 'sale_with_payment' && (extrasACobrar ?? 0) > 0;
      if (expectsPayment && !data.requiresPayment) {
        console.error('[CONTRACT VIOLATION] Gallery requires payment but backend returned requiresPayment=false', {
          galleryId, mode: gallery?.saleSettings?.mode, extrasACobrar, response: data,
        });
        toast.error('Falha na criação do pagamento', {
          description: 'Reabrindo a galeria para retomar a cobrança. Se persistir, contate o fotógrafo.',
          duration: 8000,
        });
        await refetchGallery();
        return;
      }

      // No payment required - go directly to confirmed
      setIsConfirmed(true);
      setCurrentStep('confirmed');
    },
    onError: (error: Error & { silent?: boolean }) => {
      if (error?.silent || error?.message === 'ALREADY_FINALIZED') return;
      const msg = error.message || 'Erro ao confirmar seleção';

      const upper = msg.toUpperCase();
      const providerFieldErrors: Partial<Record<'nome' | 'email' | 'phone' | 'cpfCnpj', string>> = {};
      if (upper.includes('INVALID_EMAIL') || /e-?mail\s*inv[aá]lid/i.test(msg) || /invalid.*email/i.test(msg)) {
        providerFieldErrors.email = 'O e-mail foi rejeitado pelo processador de pagamento. Confira e digite novamente.';
      }
      if (upper.includes('INVALID_PHONE') || /telefone\s*inv[aá]lid|invalid.*phone|invalid.*mobilephone/i.test(msg)) {
        providerFieldErrors.phone = 'O WhatsApp foi rejeitado pelo processador. Confira DDD e número.';
      }
      if (upper.includes('INVALID_CPF') || upper.includes('INVALID_CNPJ') || /cpf.*inv[aá]lid|cnpj.*inv[aá]lid/i.test(msg)) {
        providerFieldErrors.cpfCnpj = 'CPF/CNPJ inválido para o processador. Confira os números digitados.';
      }
      if (Object.keys(providerFieldErrors).length > 0) {
        setPreCheckoutExternalErrors(providerFieldErrors);
        setCurrentStep('pre_checkout_contact');
        return;
      }

      if (msg.includes('MISSING_CPF_CNPJ')) {
        setPreCheckoutExternalErrors({ cpfCnpj: 'CPF/CNPJ é obrigatório para gerar a cobrança.' });
        refetchGallery().finally(() => setCurrentStep('pre_checkout_contact'));
        return;
      }

      if (msg.includes('Nenhum método de pagamento configurado') || msg.includes('NO_PAYMENT_PROVIDER')) {
        toast.error('Pagamento não disponível', {
          description: 'O fotógrafo ainda não configurou o método de pagamento. Entre em contato com ele.',
          duration: 8000,
        });
      } else if (msg.includes('InfinitePay indisponível') || msg.includes('INFINITEPAY_UNAVAILABLE')) {
        toast.error('Serviço de pagamento indisponível', {
          description: 'Tente novamente em alguns minutos.',
          duration: 6000,
        });
      } else if (msg.includes('PAYMENT_CALC_MISMATCH') || msg.includes('SELECTION_SYNC_ERROR') || msg.includes('Não foi possível calcular o valor')) {
        toast.error('Não foi possível gerar sua cobrança', {
          description: 'Recarregue a página e tente novamente. Se persistir, contate o fotógrafo.',
          duration: 8000,
        });
        refetchGallery();
      } else {
        toast.error('Erro ao processar pagamento', {
          description: msg,
          duration: 6000,
        });
      }
    },
  });

  const handleStartConfirmation = () => {
    const currentSelectedCount = localPhotos.filter(p => p.isSelected).length;
    
    if (currentSelectedCount === 0) {
      toast.error('Selecione pelo menos uma foto para confirmar');
      return;
    }
    
    if (gallery && currentSelectedCount < gallery.includedPhotos) {
      setShowPartialSelectionDialog(true);
      return;
    }
    
    setCurrentStep('confirmation');
  };

  const handleConfirm = () => {
    const currentSelectedCount = localPhotos.filter(p => p.isSelected).length;
    const currentChargeType = gallery?.saleSettings?.chargeType || 'only_extras';
    const currentExtrasNecessarias = currentChargeType === 'all_selected'
      ? currentSelectedCount
      : Math.max(0, currentSelectedCount - (gallery?.includedPhotos ?? 0));
      
    const currentExtrasACobrar = Math.max(0, currentExtrasNecessarias - extrasPagasTotal);
    
    const resultado = calcularPrecoProgressivoComCredito(
      currentExtrasACobrar,
      extrasPagasTotal,
      valorJaPago,
      regrasCongeladas,
      gallery?.extraPhotoPrice || 0
    );
    
    const payload: PendingConfirmPayload = {
      selectedCount: currentSelectedCount,
      extraCount: currentExtrasACobrar,
      valorUnitario: resultado.valorUnitario,
      valorTotal: resultado.valorACobrar,
    };

    const saleMode = gallery?.saleSettings?.mode;
    const shouldRequestPayment = saleMode === 'sale_with_payment' && payload.valorTotal > 0;
    const hints = (galleryResponse as any)?.payerHints;
    const missing = (galleryResponse as any)?.payerHintsMissing;

    const isComplete = hintsAreComplete(hints) || (
      missing &&
      !missing.name &&
      !missing.email &&
      !missing.phone &&
      (!missing.cpfRequired || !missing.cpfCnpj)
    );

    const payerData = hints ? {
      nome: hints.fullName || hints.name,
      email: hints.email,
      phone: hints.phone,
      cpfCnpj: hints.cpfCnpj,
    } : undefined;

    setPendingConfirmPayload(payload);
    if (shouldRequestPayment && !isComplete) {
      setCurrentStep('pre_checkout_contact');
      return;
    }

    confirmMutation.mutate({
      ...payload,
      payer: payerData,
    });
  };

  const handlePreCheckoutSubmit = async (values: {
    nome: string; email: string; phone: string; cpfCnpj: string;
  }) => {
    setPreCheckoutExternalErrors({});
    try {
      const { data, error } = await supabase.rpc('upsert_visitor_contact', {
        p_token: identifier as string,
        p_visitor_id: visitorId || null,
        p_email: values.email,
        p_phone: values.phone,
        p_nome: values.nome,
        p_cpf_cnpj: values.cpfCnpj,
      } as any);

      if (error) {
        if ((error as any).code === '23505') {
          toast.warning(
            'Este CPF/CNPJ já está cadastrado em outro cliente do fotógrafo. ' +
            'Vamos usar seus dados apenas nesta cobrança.'
          );
        } else {
          toast.error(
            (error as any).message
              ? `Não foi possível salvar seus dados: ${(error as any).message}`
              : 'Não foi possível salvar seus dados. Verifique sua conexão e tente novamente.'
          );
          return;
        }
      } else if ((data as any)?.cpf_conflict) {
        toast.warning(
          'Este CPF/CNPJ já está vinculado a outro cadastro do fotógrafo. ' +
          'Vamos usar seus dados apenas nesta cobrança.'
        );
      }

      await refetchGallery();
      if (pendingConfirmPayload) {
        confirmMutation.mutate({
          ...pendingConfirmPayload,
          payer: {
            nome: values.nome,
            email: values.email,
            phone: values.phone,
            cpfCnpj: values.cpfCnpj,
          },
        });
      }
    } catch (e: any) {
      toast.error(
        e?.message
          ? `Falha ao salvar dados: ${e.message}`
          : 'Falha inesperada ao salvar dados. Tente novamente.'
      );
    }
  };

  const handleContactCollected = async (data: { email?: string; phone?: string; nome?: string; cpfCnpj?: string }) => {
    try {
      const { error } = await supabase.rpc('upsert_visitor_contact', {
        p_token: identifier as string,
        p_visitor_id: visitorId || null,
        p_email: data.email || null,
        p_phone: data.phone || null,
        p_nome: data.nome || null,
        p_cpf_cnpj: data.cpfCnpj || null,
      } as any);
      if (error) throw error;

      await refetchGallery();
      setContactModalOpen(false);
      setForcedMissing(null);
      if (pendingConfirmPayload) {
        confirmMutation.mutate(pendingConfirmPayload);
        setPendingConfirmPayload(null);
      } else {
        toast.success('Dados salvos. Toque em "Gerar PIX" novamente para continuar.');
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Não foi possível salvar seus dados. Tente novamente.');
    }
  };

  const handlePersistContact = async (payload: { email?: string; phone?: string; nome?: string; cpfCnpj?: string }) => {
    const { error } = await supabase.rpc('upsert_visitor_contact', {
      p_token: identifier as string,
      p_visitor_id: visitorId || null,
      p_email: payload.email || null,
      p_phone: payload.phone || null,
      p_nome: payload.nome || null,
      p_cpf_cnpj: payload.cpfCnpj || null,
    } as any);
    if (error) throw error;
    refetchGallery();
  };

  const openMissingCpfModal = () => {
    setForcedMissing({ cpfCnpj: true, cpfRequired: true, provider: 'asaas' });
    setContactModalOpen(true);
  };

  return {
    currentStep,
    setCurrentStep,
    isConfirmed,
    setIsConfirmed,
    showPartialSelectionDialog,
    setShowPartialSelectionDialog,
    contactModalOpen,
    setContactModalOpen,
    forcedMissing,
    setForcedMissing,
    pendingConfirmPayload,
    setPendingConfirmPayload,
    preCheckoutExternalErrors,
    setPreCheckoutExternalErrors,
    paymentInfo,
    setPaymentInfo,
    pixPaymentData,
    setPixPaymentData,
    asaasCheckoutData,
    setAsaasCheckoutData,
    isRedirectingToCheckout,
    setIsRedirectingToCheckout,
    confirmMutation,
    isConfirmingSelection: confirmMutation.isPending,
    handleStartConfirmation,
    handleConfirm,
    handlePreCheckoutSubmit,
    handleContactCollected,
    handlePersistContact,
    openMissingCpfModal,
  };
}
