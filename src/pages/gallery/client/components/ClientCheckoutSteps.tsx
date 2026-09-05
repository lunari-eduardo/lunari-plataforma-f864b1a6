import React from 'react';
import { PreCheckoutContactStep } from '@/components/gallery/PreCheckoutContactStep';
import { SelectionConfirmation } from '@/components/SelectionConfirmation';
import { PixPaymentScreen } from '@/components/PixPaymentScreen';
import { AsaasCheckout, AsaasCheckoutData } from '@/components/AsaasCheckout';
import { PaymentRedirect } from '@/components/PaymentRedirect';
import { Gallery, GalleryPhoto } from '@/types/gallery';
import { RegrasCongeladas } from '@/lib/pricingUtils';
import { SelectionStep, PaymentInfo, PixPaymentData, PendingConfirmPayload } from '../types';

interface ClientCheckoutStepsProps {
  currentStep: SelectionStep;
  gallery: Gallery;
  galleryResponse: any;
  localPhotos: GalleryPhoto[];
  selectedCount: number;
  extraCount: number;
  extrasACobrar: number;
  extrasPagasTotal: number;
  valorJaPago: number;
  regrasCongeladas: RegrasCongeladas | null;
  isConfirmingSelection: boolean;
  pendingConfirmPayload: PendingConfirmPayload | null;
  preCheckoutExternalErrors: Partial<Record<'nome' | 'email' | 'phone' | 'cpfCnpj', string>>;
  pixPaymentData: PixPaymentData | null;
  asaasCheckoutData: AsaasCheckoutData | null;
  paymentInfo: PaymentInfo | null;
  themeStyles: React.CSSProperties;
  effectiveBackgroundMode: 'light' | 'dark';
  contactModalNode: React.ReactNode;
  payerHintsPrefill?: any;
  payerMissingFlags?: any;
  openMissingCpfModal: () => void;
  handlePersistContact: (payload: { email?: string; phone?: string; nome?: string; cpfCnpj?: string }) => Promise<void>;
  onPreCheckoutSubmit: (values: { nome: string; email: string; phone: string; cpfCnpj: string }) => Promise<void>;
  onPreCheckoutBack: () => void;
  onConfirm: () => void;
  onConfirmationBack: () => void;
  onPixPaymentConfirmed: () => Promise<void>;
  onAsaasPaymentConfirmed: () => Promise<void>;
  onAsaasCancel: () => void;
  onPaymentRedirectCancel: () => void;
}

export function ClientCheckoutSteps({
  currentStep,
  gallery,
  galleryResponse,
  localPhotos,
  selectedCount,
  extraCount,
  extrasACobrar,
  extrasPagasTotal,
  valorJaPago,
  regrasCongeladas,
  isConfirmingSelection,
  pendingConfirmPayload,
  preCheckoutExternalErrors,
  pixPaymentData,
  asaasCheckoutData,
  paymentInfo,
  themeStyles,
  effectiveBackgroundMode,
  contactModalNode,
  payerHintsPrefill,
  payerMissingFlags,
  openMissingCpfModal,
  handlePersistContact,
  onPreCheckoutSubmit,
  onPreCheckoutBack,
  onConfirm,
  onConfirmationBack,
  onPixPaymentConfirmed,
  onAsaasPaymentConfirmed,
  onAsaasCancel,
  onPaymentRedirectCancel,
}: ClientCheckoutStepsProps) {
  // 1. Etapa de coleta de dados de contato pré-checkout
  if (currentStep === 'pre_checkout_contact' && pendingConfirmPayload) {
    const hints = (galleryResponse as any)?.payerHints as
      | { fullName?: string | null; email?: string | null; phone?: string | null; cpfCnpj?: string | null }
      | undefined;

    return (
      <PreCheckoutContactStep
        valorTotal={pendingConfirmPayload.valorTotal}
        provider={(gallery.saleSettings?.paymentMethod as any) || null}
        studioName={galleryResponse?.studioSettings?.studio_name}
        photographerFirstName={(() => {
          const raw = (galleryResponse?.studioSettings as any)?.photographer_name
            || galleryResponse?.studioSettings?.studio_name
            || '';
          return String(raw).trim().split(/\s+/)[0] || undefined;
        })()}
        prefill={{
          fullName: hints?.fullName,
          email: hints?.email,
          phone: hints?.phone,
          cpfCnpj: hints?.cpfCnpj,
        }}
        missing={{
          name: !hints?.fullName,
          email: !hints?.email,
          phone: !hints?.phone,
          cpfCnpj: !hints?.cpfCnpj,
        }}
        isSubmitting={isConfirmingSelection}
        externalErrors={preCheckoutExternalErrors}
        onBack={onPreCheckoutBack}
        onSubmit={onPreCheckoutSubmit}
        themeStyles={themeStyles}
        backgroundMode={effectiveBackgroundMode}
      />
    );
  }

  // 2. Etapa de confirmação de seleção e revisão
  if (currentStep === 'confirmation') {
    const isWithPayment = gallery.saleSettings?.mode === 'sale_with_payment';
    const hasPaymentProvider = isWithPayment && !!gallery.saleSettings?.paymentMethod;

    return (
      <SelectionConfirmation
        gallery={gallery}
        photos={localPhotos}
        selectedCount={selectedCount}
        extraCount={extraCount}
        extrasACobrar={extrasACobrar}
        extrasPagasAnteriormente={extrasPagasTotal}
        valorJaPago={valorJaPago}
        regrasCongeladas={regrasCongeladas}
        hasPaymentProvider={hasPaymentProvider}
        isConfirming={isConfirmingSelection}
        onBack={onConfirmationBack}
        onConfirm={onConfirm}
        themeStyles={themeStyles}
        backgroundMode={effectiveBackgroundMode}
      />
    );
  }

  // 3. Pagamentos diretos após confirmação
  if (currentStep === 'payment' && pixPaymentData) {
    return (
      <PixPaymentScreen
        chavePix={pixPaymentData.chavePix}
        nomeTitular={pixPaymentData.nomeTitular}
        tipoChave={pixPaymentData.tipoChave}
        valorTotal={pixPaymentData.valorTotal}
        studioName={galleryResponse?.studioSettings?.studio_name}
        studioLogoUrl={galleryResponse?.studioSettings?.studio_logo_url}
        onPaymentConfirmed={onPixPaymentConfirmed}
        themeStyles={themeStyles}
        backgroundMode={effectiveBackgroundMode}
      />
    );
  }

  if (currentStep === 'payment' && asaasCheckoutData) {
    return (
      <>
        <AsaasCheckout
          data={asaasCheckoutData}
          studioName={galleryResponse?.studioSettings?.studio_name}
          studioLogoUrl={galleryResponse?.studioSettings?.studio_logo_url}
          onPaymentConfirmed={onAsaasPaymentConfirmed}
          onCancel={onAsaasCancel}
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

  if (currentStep === 'payment' && paymentInfo) {
    return (
      <PaymentRedirect
        checkoutUrl={paymentInfo.checkoutUrl}
        provedor={paymentInfo.provedor}
        valorTotal={paymentInfo.valorTotal}
        onCancel={onPaymentRedirectCancel}
        themeStyles={themeStyles}
        backgroundMode={effectiveBackgroundMode}
      />
    );
  }

  return null;
}
