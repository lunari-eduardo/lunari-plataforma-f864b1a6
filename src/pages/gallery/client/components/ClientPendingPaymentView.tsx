import React, { useState } from 'react';
import { toast } from 'sonner';
import { AsaasCheckout, AsaasCheckoutData } from '@/components/AsaasCheckout';
import { PixPaymentScreen } from '@/components/PixPaymentScreen';
import { PaymentPendingScreen } from '@/components/PaymentPendingScreen';
import { SUPABASE_URL } from '../types';

interface ClientPendingPaymentViewProps {
  galleryId: string | null | undefined;
  identifier?: string;
  sessionId: string | null | undefined;
  visitorId: string | null;
  galleryResponse: any;
  themeStyles: React.CSSProperties;
  effectiveBackgroundMode: 'light' | 'dark';
  onPaymentConfirmed: () => void;
  refetchGallery: () => Promise<any>;
  openMissingCpfModal: () => void;
  payerHintsPrefill?: any;
  payerMissingFlags?: any;
  handlePersistContact: (payload: { email?: string; phone?: string; nome?: string; cpfCnpj?: string }) => Promise<void>;
  contactModalNode: React.ReactNode;
}

export function ClientPendingPaymentView({
  galleryId,
  identifier,
  sessionId,
  visitorId,
  galleryResponse,
  themeStyles,
  effectiveBackgroundMode,
  onPaymentConfirmed,
  refetchGallery,
  openMissingCpfModal,
  payerHintsPrefill,
  payerMissingFlags,
  handlePersistContact,
  contactModalNode,
}: ClientPendingPaymentViewProps) {
  const [showInlineCheckout, setShowInlineCheckout] = useState(false);
  const [isConfirmingPixPayment, setIsConfirmingPixPayment] = useState(false);

  const pendingPaymentMethod = galleryResponse?.paymentMethod;
  const pendingPixDados = galleryResponse?.pixDados;
  const pendingCheckoutUrl = galleryResponse?.checkoutUrl;
  const pendingValorTotal = galleryResponse?.valorTotal || 0;
  const awaitingCharge = Boolean(galleryResponse?.awaitingCharge) || !galleryResponse?.cobrancaId;

  const pendingAction = (galleryResponse as any)?.pendingAction as
    | { kind: 'external_redirect' | 'asaas_modal' | 'pix_modal' | 'regenerate'; checkoutUrl?: string; provedor: string }
    | undefined;

  const routeFromFreshData = (fresh: any) => {
    const freshAction = fresh?.pendingAction;
    const freshCheckoutUrl =
      freshAction?.checkoutUrl || fresh?.checkoutUrl || null;
    if (freshAction?.kind === 'external_redirect' && freshCheckoutUrl) {
      window.location.assign(freshCheckoutUrl);
      return true;
    }
    if (
      (freshAction?.kind === 'asaas_modal' && fresh?.asaasCheckoutData) ||
      (freshAction?.kind === 'pix_modal' && fresh?.pixDados) ||
      (fresh?.paymentMethod === 'asaas' && fresh?.asaasCheckoutData) ||
      (fresh?.paymentMethod === 'pix_manual' && fresh?.pixDados)
    ) {
      setShowInlineCheckout(true);
      return true;
    }
    if (freshCheckoutUrl) {
      window.location.assign(freshCheckoutUrl);
      return true;
    }
    return false;
  };

  const handleRegenerateCharge = async () => {
    try {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/client-selection`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          galleryToken: identifier,
          action: 'regenerate_charge',
          visitorId: visitorId || undefined,
        }),
      });
      const result = await response.json().catch(() => ({} as any));
      if (!response.ok || !result?.success) {
        const msg = result?.error || 'Não foi possível gerar o link agora.';
        const code = result?.code ? ` (${result.code})` : '';
        throw new Error(`${msg}${code}`);
      }

      const charge = result?.data?.charge || {};

      if (charge?.code === 'NO_AMOUNT_DUE' || charge?.alreadyPaid) {
        toast.success('Pagamento já concluído');
        await refetchGallery();
        return;
      }

      if (charge?.checkoutUrl) {
        toast.success('Redirecionando...');
        window.location.assign(charge.checkoutUrl);
        return;
      }

      if (charge?.transparentCheckout || charge?.provedor === 'asaas' || charge?.provedor === 'pix_manual') {
        toast.success('Abrindo pagamento...');
        const fresh = await refetchGallery();
        if (routeFromFreshData(fresh?.data)) return;
        setShowInlineCheckout(true);
        return;
      }

      const fresh = await refetchGallery();
      if (!routeFromFreshData(fresh?.data)) {
        toast.error('Não foi possível abrir o pagamento. Tente novamente.');
      }
    } catch (e) {
      console.error('[handleRegenerateCharge] erro:', e);
      const errMsg = e instanceof Error ? e.message : 'Erro ao gerar novo link';
      
      if (errMsg.includes('PAYMENT_CREATE_ERROR') || errMsg.toLowerCase().includes('maior que zero') || errMsg.includes('SYNC_REQUIRED')) {
        toast.info('Sincronizando cobrança...');
        const fresh = await refetchGallery();
        if (routeFromFreshData(fresh?.data)) return;
      } else {
        toast.error(errMsg);
      }
    }
  };

  const handleResume = async () => {
    if (pendingAction?.kind === 'asaas_modal' && galleryResponse?.asaasCheckoutData) {
      toast.success('Abrindo pagamento...');
      setShowInlineCheckout(true);
      return;
    }
    if (pendingAction?.kind === 'pix_modal' && pendingPixDados) {
      toast.success('Abrindo pagamento...');
      setShowInlineCheckout(true);
      return;
    }
    if (pendingPaymentMethod === 'asaas' && galleryResponse?.asaasCheckoutData) {
      toast.success('Abrindo pagamento...');
      setShowInlineCheckout(true);
      return;
    }
    if (pendingPaymentMethod === 'pix_manual' && pendingPixDados) {
      toast.success('Abrindo pagamento...');
      setShowInlineCheckout(true);
      return;
    }
    if (pendingCheckoutUrl) {
      toast.success('Redirecionando...');
      window.location.assign(pendingCheckoutUrl);
      return;
    }
    await handleRegenerateCharge();
  };

  const handlePixPaymentConfirmed = async () => {
    setIsConfirmingPixPayment(true);
    try {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/client-selection`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          galleryToken: identifier,
          action: 'finalize_payment',
          visitorId: visitorId || undefined,
        }),
      });
      
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Erro ao confirmar pagamento');
      }
      
      await refetchGallery();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao informar pagamento');
    } finally {
      setIsConfirmingPixPayment(false);
    }
  };

  // Checkout inline
  if (showInlineCheckout) {
    if (
      (pendingAction?.kind === 'asaas_modal' || pendingPaymentMethod === 'asaas') &&
      galleryResponse?.asaasCheckoutData
    ) {
      return (
        <>
          <AsaasCheckout
            data={galleryResponse.asaasCheckoutData as AsaasCheckoutData}
            studioName={galleryResponse.studioSettings?.studio_name}
            studioLogoUrl={galleryResponse.studioSettings?.studio_logo_url}
            onPaymentConfirmed={async () => {
              setShowInlineCheckout(false);
              onPaymentConfirmed();
              await refetchGallery();
            }}
            onMissingCpf={openMissingCpfModal}
            payerHints={payerHintsPrefill}
            payerMissing={payerMissingFlags}
            onPersistContact={handlePersistContact}
            themeStyles={themeStyles}
            backgroundMode={effectiveBackgroundMode}
          />
          {contactModalNode}
        </>
      );
    }

    if (
      (pendingAction?.kind === 'pix_modal' || pendingPaymentMethod === 'pix_manual') &&
      pendingPixDados
    ) {
      return (
        <PixPaymentScreen
          chavePix={pendingPixDados.chavePix || ''}
          nomeTitular={pendingPixDados.nomeTitular || ''}
          tipoChave={pendingPixDados.tipoChave}
          valorTotal={pendingValorTotal}
          studioName={galleryResponse.studioSettings?.studio_name}
          studioLogoUrl={galleryResponse.studioSettings?.studio_logo_url}
          onPaymentConfirmed={handlePixPaymentConfirmed}
          themeStyles={themeStyles}
          backgroundMode={effectiveBackgroundMode}
          isConfirming={isConfirmingPixPayment}
        />
      );
    }
  }

  const screenAction = pendingAction
    ? pendingAction.kind === 'external_redirect'
      ? { kind: 'external_redirect' as const, checkoutUrl: pendingAction.checkoutUrl || '', provedor: pendingAction.provedor }
      : pendingAction.kind === 'regenerate'
        ? { kind: 'regenerate' as const, provedor: pendingAction.provedor }
        : { kind: 'resume_modal' as const, provedor: pendingAction.provedor }
    : awaitingCharge
      ? { kind: 'regenerate' as const, provedor: pendingPaymentMethod || 'desconhecido' }
      : pendingCheckoutUrl
        ? { kind: 'external_redirect' as const, checkoutUrl: pendingCheckoutUrl, provedor: pendingPaymentMethod || 'externo' }
        : (pendingPaymentMethod === 'asaas' && galleryResponse?.asaasCheckoutData) ||
          (pendingPaymentMethod === 'pix_manual' && pendingPixDados)
          ? { kind: 'resume_modal' as const, provedor: pendingPaymentMethod }
          : { kind: 'regenerate' as const, provedor: pendingPaymentMethod || 'desconhecido' };

  return (
    <PaymentPendingScreen
      galleryId={galleryId}
      galleryToken={identifier}
      cobrancaId={galleryResponse?.cobrancaId}
      sessionId={sessionId || undefined}
      checkoutUrl={pendingCheckoutUrl}
      valorTotal={pendingValorTotal}
      provedor={pendingPaymentMethod || 'pagamento'}
      studioName={galleryResponse?.studioSettings?.studio_name}
      studioLogoUrl={galleryResponse?.studioSettings?.studio_logo_url}
      themeStyles={themeStyles}
      backgroundMode={effectiveBackgroundMode}
      awaitingCharge={awaitingCharge}
      pendingAction={screenAction}
      onResume={handleResume}
      onRegenerate={handleRegenerateCharge}
      onPaymentConfirmed={onPaymentConfirmed}
    />
  );
}
