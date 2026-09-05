import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { AlertCircle, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { UnifiedAccessScreen } from '@/components/UnifiedAccessScreen';
import { FinalizedPreviewScreen } from '@/components/FinalizedPreviewScreen';
import { ContactCollectionModal, ContactCollectionMissing } from '@/components/ContactCollectionModal';
import { getFontFamilyById } from '@/components/FontSelect';
import { TitleCaseMode } from '@/types/gallery';
import ClientDeliverGallery from '@/pages/gallery/ClientDeliverGallery';

import { useClientGalleryTheme } from './client/hooks/useClientGalleryTheme';
import { useClientGalleryAuth } from './client/hooks/useClientGalleryAuth';
import { useClientGalleryData } from './client/hooks/useClientGalleryData';
import { usePaymentDetection } from './client/hooks/usePaymentDetection';
import { useClientGallerySelection } from './client/hooks/useClientGallerySelection';
import { useClientGalleryConfirmation } from './client/hooks/useClientGalleryConfirmation';

import { ClientGalleryLoading } from './client/components/ClientGalleryLoading';
import { ClientGalleryExpired } from './client/components/ClientGalleryExpired';
import { ClientConfirmedView } from './client/components/ClientConfirmedView';
import { ClientAlbumsView } from './client/components/ClientAlbumsView';
import { ClientPendingPaymentView } from './client/components/ClientPendingPaymentView';
import { ClientCheckoutSteps } from './client/components/ClientCheckoutSteps';
import { ClientGalleryGrid } from './client/components/ClientGalleryGrid';

export default function ClientGallery() {
  const { id, token } = useParams();
  const identifier = token || id;

  const [refetchTrigger, setRefetchTrigger] = useState(0);

  const auth = useClientGalleryAuth({
    identifier,
    galleryResponse: null,
    refetchGallery: async () => setRefetchTrigger(prev => prev + 1),
  });

  const {
    galleryResponse,
    supabaseGallery,
    galleryId,
    sessionId,
    sessionRegras,
    transformedGallery,
    photos,
    isLoading,
    galleryError,
    refetchGallery,
  } = useClientGalleryData({
    identifier,
    sessionPassword: auth.sessionPassword,
    visitorId: auth.visitorId,
  });

  const { effectiveBackgroundMode, themeStyles } = useClientGalleryTheme({
    galleryResponse,
    sessionName: transformedGallery?.sessionName,
  });

  const [showWelcome, setShowWelcome] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    const isPaymentReturn = params.get('payment') === 'success';
    if (isPaymentReturn) return false;
    const key = `gallery_welcome_${identifier || ''}`;
    return !sessionStorage.getItem(key);
  });

  const handleCloseWelcome = () => {
    setShowWelcome(false);
    if (identifier) sessionStorage.setItem(`gallery_welcome_${identifier}`, 'true');
    if (supabaseGallery?.id) sessionStorage.setItem(`gallery_welcome_${supabaseGallery.id}`, 'true');
  };

  const selection = useClientGallerySelection({
    identifier,
    galleryId,
    visitorId: auth.visitorId,
    photos,
    gallery: transformedGallery,
    supabaseGallery,
    sessionRegras,
    isConfirmed: false,
  });

  const confirmation = useClientGalleryConfirmation({
    identifier,
    galleryId,
    sessionId,
    visitorId: auth.visitorId,
    gallery: transformedGallery,
    galleryResponse,
    localPhotos: selection.localPhotos,
    regrasCongeladas: selection.regrasCongeladas,
    extrasPagasTotal: selection.extrasPagasTotal,
    valorJaPago: selection.valorJaPago,
    extrasACobrar: selection.extrasACobrar,
    refetchGallery,
  });

  const { isProcessingPaymentReturn } = usePaymentDetection({
    identifier,
    galleryId,
    sessionId,
    visitorId: auth.visitorId,
    onPaymentSuccess: () => {
      confirmation.setCurrentStep('confirmed');
      confirmation.setIsConfirmed(true);
      setShowWelcome(false);
    },
    refetchGallery,
  });

  useEffect(() => {
    if (photos.length > 0) {
      const isAlreadyConfirmed = 
        supabaseGallery?.status_selecao === 'selecao_completa' || 
        supabaseGallery?.finalized_at ||
        galleryResponse?.finalized;
      
      const isAwaitingPayment = 
        supabaseGallery?.status_selecao === 'aguardando_pagamento' ||
        galleryResponse?.pendingPayment;
      
      const shouldBeConfirmed = !!isAlreadyConfirmed && !isAwaitingPayment;
      
      if (shouldBeConfirmed && !confirmation.isConfirmed) {
        confirmation.setIsConfirmed(true);
        confirmation.setCurrentStep('confirmed');
        setShowWelcome(false);
      } else if (isAwaitingPayment && confirmation.currentStep !== 'payment') {
        confirmation.setCurrentStep('payment');
        setShowWelcome(false);
      }
    }
  }, [photos, supabaseGallery?.status_selecao, supabaseGallery?.finalized_at, galleryResponse]);

  const effectiveMissing: ContactCollectionMissing = {
    ...((galleryResponse?.payerHintsMissing as ContactCollectionMissing) || {
      email: false, phone: false, name: false,
    }),
    ...(confirmation.forcedMissing || {}),
  };

  const contactModalNode = (
    <ContactCollectionModal
      open={confirmation.contactModalOpen}
      missing={effectiveMissing}
      onCancel={() => { 
        confirmation.setContactModalOpen(false); 
        confirmation.setPendingConfirmPayload(null); 
        confirmation.setForcedMissing(null); 
      }}
      onSubmit={confirmation.handleContactCollected}
      themeStyles={themeStyles}
      backgroundMode={effectiveBackgroundMode}
    />
  );

  const payerHintsPrefill = (galleryResponse as any)?.payerHints || undefined;
  const payerMissingFlags = (galleryResponse?.payerHintsMissing as ContactCollectionMissing | undefined)
    ? {
        name: !!galleryResponse?.payerHintsMissing?.name,
        email: !!galleryResponse?.payerHintsMissing?.email,
        phone: !!galleryResponse?.payerHintsMissing?.phone,
        cpfCnpj: !!galleryResponse?.payerHintsMissing?.cpfCnpj,
      }
    : undefined;

  // 1. Overlay imediato de redirecionamento de checkout
  if (confirmation.isRedirectingToCheckout) {
    return (
      <ClientGalleryLoading
        themeStyles={themeStyles}
        studioLogoUrl={galleryResponse?.studioSettings?.studio_logo_url}
        isRedirecting={true}
        effectiveBackgroundMode={effectiveBackgroundMode}
      />
    );
  }

  // 2. Carregamento inicial da galeria
  if (isLoading) {
    return (
      <ClientGalleryLoading
        themeStyles={themeStyles}
        studioLogoUrl={galleryResponse?.studioSettings?.studio_logo_url}
        isRedirecting={false}
        effectiveBackgroundMode={effectiveBackgroundMode}
      />
    );
  }

  // 3. Autenticação por senha ou registro de visitante
  if ((auth.requiresPassword && !auth.sessionPassword) || (auth.requiresVisitor && !auth.visitorId)) {
    return (
      <UnifiedAccessScreen
        sessionName={galleryResponse?.sessionName}
        sessionFont={getFontFamilyById(supabaseGallery?.configuracoes?.sessionFont || galleryResponse?.settings?.sessionFont)}
        titleCaseMode={(supabaseGallery?.configuracoes?.titleCaseMode || galleryResponse?.settings?.titleCaseMode) as TitleCaseMode || 'normal'}
        studioName={galleryResponse?.studioSettings?.studio_name}
        studioLogo={galleryResponse?.studioSettings?.studio_logo_url}
        requiresPassword={auth.requiresPassword && !auth.sessionPassword}
        requiresVisitor={auth.requiresVisitor && !auth.visitorId}
        totalPhotos={galleryResponse?.pagination?.total || selection.localPhotos.length}
        includedPhotos={transformedGallery?.includedPhotos}
        deadline={transformedGallery?.settings?.deadline}
        welcomeMessage={supabaseGallery?.configuracoes?.welcomeMessage || galleryResponse?.settings?.welcomeMessage}
        onSubmit={async (data) => {
          if (data.password) await auth.handlePasswordSubmit(data.password);
          if (data.visitor) await auth.handleVisitorSubmit(data.visitor);
        }}
        error={auth.passwordError || auth.visitorError}
        isLoading={auth.isCheckingPassword || auth.isRegisteringVisitor}
        themeStyles={themeStyles}
        backgroundMode={effectiveBackgroundMode}
      />
    );
  }

  // 4. Galeria de Entrega
  if (galleryResponse?.deliver) {
    return <ClientDeliverGallery data={galleryResponse} />;
  }

  // 5. Travamento e Preview de Galeria Finalizada
  const selectionLocked = Boolean(
    galleryResponse?.selectionLocked
    || galleryResponse?.finalized
    || (galleryResponse as any)?.finalizedAt
    || supabaseGallery?.finalized_at
    || supabaseGallery?.status_selecao === 'aguardando_pagamento'
    || supabaseGallery?.status_selecao === 'selecao_completa'
    || supabaseGallery?.status_selecao === 'processando_selecao'
  );
  const hasPaid = Boolean(galleryResponse?.hasPaid);

  if (selectionLocked && (hasPaid || confirmation.isConfirmed) && (galleryResponse?.finalized || confirmation.isConfirmed)) {
    return (
      <FinalizedPreviewScreen
        photos={galleryResponse.photos || []}
        galleryId={galleryId || ''}
        sessionName={galleryResponse.sessionName}
        sessionFont={getFontFamilyById(supabaseGallery?.configuracoes?.sessionFont || galleryResponse?.settings?.sessionFont)}
        titleCaseMode={(supabaseGallery?.configuracoes?.titleCaseMode || galleryResponse?.settings?.titleCaseMode) as TitleCaseMode || 'normal'}
        studioLogoUrl={galleryResponse.studioSettings?.studio_logo_url}
        studioName={galleryResponse.studioSettings?.studio_name}
        allowDownload={galleryResponse.allowDownload || false}
        themeStyles={themeStyles}
        backgroundMode={effectiveBackgroundMode}
      />
    );
  }

  // 6. Galeria Expirada
  if (galleryResponse?.expired) {
    return (
      <ClientGalleryExpired
        themeStyles={themeStyles}
        sessionName={galleryResponse?.sessionName || ''}
        sessionFont={getFontFamilyById(supabaseGallery?.configuracoes?.sessionFont || galleryResponse?.settings?.sessionFont)}
        titleCaseMode={(supabaseGallery?.configuracoes?.titleCaseMode || galleryResponse?.settings?.titleCaseMode) as TitleCaseMode || 'normal'}
        studioLogoUrl={galleryResponse?.studioSettings?.studio_logo_url}
        studioName={galleryResponse?.studioSettings?.studio_name}
      />
    );
  }

  // Se o pagamento acabou de ser confirmado localmente mas o refetch ainda está em trânsito
  if (selectionLocked && confirmation.isConfirmed && !hasPaid) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background" style={themeStyles}>
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-primary" />
        <p className="mt-4 text-sm text-muted-foreground">Finalizando sua seleção...</p>
      </div>
    );
  }

  // 7. Pagamento Pendente (travada e não paga)
  if (selectionLocked && !hasPaid && !isProcessingPaymentReturn && !confirmation.isConfirmed) {
    return (
      <ClientPendingPaymentView
        galleryId={galleryId}
        identifier={identifier}
        sessionId={sessionId}
        visitorId={auth.visitorId}
        galleryResponse={galleryResponse}
        themeStyles={themeStyles}
        effectiveBackgroundMode={effectiveBackgroundMode}
        onPaymentConfirmed={() => {
          confirmation.setCurrentStep('confirmed');
          confirmation.setIsConfirmed(true);
          refetchGallery();
        }}
        refetchGallery={refetchGallery}
        openMissingCpfModal={confirmation.openMissingCpfModal}
        payerHintsPrefill={payerHintsPrefill}
        payerMissingFlags={payerMissingFlags}
        handlePersistContact={confirmation.handlePersistContact}
        contactModalNode={contactModalNode}
      />
    );
  }

  // Retorno de pagamento com galeria momentaneamente nula
  if (isProcessingPaymentReturn && !transformedGallery) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background" style={themeStyles}>
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-primary" />
        <p className="mt-4 text-sm text-muted-foreground">Finalizando...</p>
      </div>
    );
  }

  // 8. Erro de galeria não encontrada ou não disponível
  if ((galleryError || !transformedGallery) && !auth.requiresPassword && !auth.requiresVisitor) {
    const errorMessage = galleryError?.message || '';
    const isNotAvailable = errorMessage === 'Galeria não disponível';
    const isPublishing = errorMessage === 'GALLERY_PUBLISHING';
    
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <main className="flex-1 flex items-center justify-center p-6">
          <div className="max-w-md w-full text-center space-y-6">
            <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto ${isPublishing ? 'bg-primary/10' : isNotAvailable ? 'bg-muted' : 'bg-destructive/10'}`}>
              {isPublishing ? (
                <Clock className="h-10 w-10 text-primary animate-pulse" />
              ) : (
                <AlertCircle className={`h-10 w-10 ${isNotAvailable ? 'text-muted-foreground' : 'text-destructive'}`} />
              )}
            </div>
            <div>
              <h1 className="text-2xl font-bold mb-2">
                {isPublishing ? 'Galeria em publicação' : isNotAvailable ? 'Galeria não disponível' : 'Galeria não encontrada'}
              </h1>
              <p className="text-muted-foreground text-sm">
                {isPublishing 
                  ? 'A galeria está sendo preparada. Tente novamente em alguns instantes.'
                  : isNotAvailable
                  ? 'Esta galeria ainda não está acessível. Entre em contato com o fotógrafo.'
                  : 'Verifique se o link está correto ou entre em contato com o fotógrafo.'}
              </p>
            </div>
            {isPublishing && (
              <Button variant="outline" onClick={() => refetchGallery()}>
                Tentar novamente
              </Button>
            )}
            <div className="lunari-card p-4">
              <p className="text-xs text-muted-foreground">
                ID solicitado: <code className="bg-muted px-1 rounded">{identifier}</code>
              </p>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // 9. Galeria confirmada (modo read-only)
  if (confirmation.isConfirmed && confirmation.currentStep !== 'confirmation' && confirmation.currentStep !== 'payment') {
    return (
      <ClientConfirmedView
        gallery={transformedGallery!}
        localPhotos={selection.localPhotos}
        studioLogoUrl={galleryResponse?.studioSettings?.studio_logo_url}
        studioName={galleryResponse?.studioSettings?.studio_name}
        themeStyles={themeStyles}
        effectiveBackgroundMode={effectiveBackgroundMode}
        photoSpacing={supabaseGallery?.configuracoes?.photoSpacing ?? galleryResponse?.settings?.photoSpacing ?? transformedGallery?.settings?.photoSpacing ?? 6}
      />
    );
  }

  // 10. Etapas de Checkout / Pagamento
  if (
    confirmation.currentStep === 'pre_checkout_contact' ||
    confirmation.currentStep === 'confirmation' ||
    confirmation.currentStep === 'payment'
  ) {
    return (
      <ClientCheckoutSteps
        currentStep={confirmation.currentStep}
        gallery={transformedGallery!}
        galleryResponse={galleryResponse}
        localPhotos={selection.localPhotos}
        selectedCount={selection.selectedCount}
        extraCount={selection.extraCount}
        extrasACobrar={selection.extrasACobrar}
        extrasPagasTotal={selection.extrasPagasTotal}
        valorJaPago={selection.valorJaPago}
        regrasCongeladas={selection.regrasCongeladas}
        isConfirmingSelection={confirmation.isConfirmingSelection}
        pendingConfirmPayload={confirmation.pendingConfirmPayload}
        preCheckoutExternalErrors={confirmation.preCheckoutExternalErrors}
        pixPaymentData={confirmation.pixPaymentData}
        asaasCheckoutData={confirmation.asaasCheckoutData}
        paymentInfo={confirmation.paymentInfo}
        themeStyles={themeStyles}
        effectiveBackgroundMode={effectiveBackgroundMode}
        contactModalNode={contactModalNode}
        payerHintsPrefill={payerHintsPrefill}
        payerMissingFlags={payerMissingFlags}
        openMissingCpfModal={confirmation.openMissingCpfModal}
        handlePersistContact={confirmation.handlePersistContact}
        onPreCheckoutSubmit={confirmation.handlePreCheckoutSubmit}
        onPreCheckoutBack={() => {
          confirmation.setPreCheckoutExternalErrors({});
          confirmation.setCurrentStep('confirmation');
        }}
        onConfirm={confirmation.handleConfirm}
        onConfirmationBack={() => confirmation.setCurrentStep('gallery')}
        onPixPaymentConfirmed={async () => {
          confirmation.setIsConfirmed(true);
          confirmation.setCurrentStep('confirmed');
          refetchGallery();
        }}
        onAsaasPaymentConfirmed={async () => {
          confirmation.setAsaasCheckoutData(null);
          confirmation.setCurrentStep('confirmed');
          confirmation.setIsConfirmed(true);
          await refetchGallery();
        }}
        onAsaasCancel={() => {
          confirmation.setAsaasCheckoutData(null);
          confirmation.setCurrentStep('confirmation');
        }}
        onPaymentRedirectCancel={() => confirmation.setCurrentStep('confirmed')}
      />
    );
  }

  // 11. Visão de Álbuns / Pastas
  const galleryFolders = galleryResponse?.folders || [];
  const hasFolders = galleryFolders.length > 0;

  if (hasFolders && selection.folderViewMode === 'albums' && selection.activeFolderId === null) {
    return (
      <ClientAlbumsView
        gallery={transformedGallery!}
        galleryFolders={galleryFolders}
        localPhotos={selection.localPhotos}
        studioLogoUrl={galleryResponse?.studioSettings?.studio_logo_url}
        studioName={galleryResponse?.studioSettings?.studio_name}
        themeStyles={themeStyles}
        effectiveBackgroundMode={effectiveBackgroundMode}
        onSelectFolder={(folderId) => {
          selection.setActiveFolderId(folderId);
          selection.setFolderViewMode('grid');
        }}
      />
    );
  }

  // 12. Grid principal da galeria
  return (
    <>
      <ClientGalleryGrid
        gallery={transformedGallery!}
        galleryResponse={galleryResponse}
        supabaseGallery={supabaseGallery}
        localPhotos={selection.localPhotos}
        displayPhotos={selection.displayPhotos}
        filterMode={selection.filterMode}
        onFilterChange={selection.setFilterMode}
        hasFolders={hasFolders}
        galleryFolders={galleryFolders}
        activeFolderId={selection.activeFolderId}
        setActiveFolderId={selection.setActiveFolderId}
        setFolderViewMode={selection.setFolderViewMode}
        visitorName={auth.visitorName}
        hasDeadline={selection.hasDeadline}
        hoursUntilDeadline={selection.hoursUntilDeadline}
        isNearDeadline={selection.isNearDeadline}
        isExpired={selection.isExpired}
        isBlocked={selection.isBlocked}
        isConfirmed={confirmation.isConfirmed}
        selectedCount={selection.selectedCount}
        extraCount={selection.extraCount}
        extrasPagasTotal={selection.extrasPagasTotal}
        extrasACobrar={selection.extrasACobrar}
        extraTotal={selection.extraTotal}
        valorJaPago={selection.valorJaPago}
        regrasCongeladas={selection.regrasCongeladas}
        toggleSelection={selection.toggleSelection}
        handleComment={selection.handleComment}
        handleFavorite={selection.handleFavorite}
        handleStartConfirmation={confirmation.handleStartConfirmation}
        showPartialSelectionDialog={confirmation.showPartialSelectionDialog}
        setShowPartialSelectionDialog={confirmation.setShowPartialSelectionDialog}
        onProceedPartialSelection={() => confirmation.setCurrentStep('confirmation')}
        showWelcome={showWelcome}
        handleCloseWelcome={handleCloseWelcome}
        themeStyles={themeStyles}
        effectiveBackgroundMode={effectiveBackgroundMode}
      />
      {contactModalNode}
    </>
  );
}
