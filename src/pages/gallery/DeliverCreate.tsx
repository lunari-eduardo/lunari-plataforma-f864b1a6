import { Skeleton } from '@/components/ui/skeleton';
import { ClientModal } from '@/components/ClientModal';

import { useDeliverCreateState } from './deliver/create/hooks/useDeliverCreateState';
import { useDeliverCreateActions } from './deliver/create/hooks/useDeliverCreateActions';
import { DeliverStorageExceeded } from './deliver/create/components/DeliverStorageExceeded';
import { DeliverCreateHeader } from './deliver/create/components/DeliverCreateHeader';
import { DeliverCreateStep1Data } from './deliver/create/components/DeliverCreateStep1Data';
import { DeliverCreateStep2Visual } from './deliver/create/components/DeliverCreateStep2Visual';
import { DeliverCreateStep3Photos } from './deliver/create/components/DeliverCreateStep3Photos';
import { DeliverCreateStep4Message } from './deliver/create/components/DeliverCreateStep4Message';
import { DeliverCreateFooter } from './deliver/create/components/DeliverCreateFooter';

export default function DeliverCreate() {
  const state = useDeliverCreateState();
  const actions = useDeliverCreateActions(state);
  const { storageUsedBytes, storageLimitBytes, storageUsedPercent, canCreateTransfer, isUnlimited, planName, isLoading: isLoadingStorage } = state.transferStorage as any;

  if (isLoadingStorage) {
    return (
      <div className="max-w-5xl mx-auto py-16 flex items-center justify-center">
        <Skeleton className="h-32 w-full max-w-md" />
      </div>
    );
  }

  if (!canCreateTransfer) {
    return (
      <DeliverStorageExceeded
        storageLimitBytes={storageLimitBytes}
        storageUsedBytes={storageUsedBytes}
        storageUsedPercent={storageUsedPercent}
        isUnlimited={isUnlimited}
        planName={planName}
      />
    );
  }

  const renderStep = () => {
    switch (state.currentStep) {
      case 1:
        return (
          <DeliverCreateStep1Data
            galleryPermission={state.galleryPermission}
            setGalleryPermission={state.setGalleryPermission}
            selectedClient={state.selectedClient}
            setSelectedClient={state.setSelectedClient}
            clients={state.clients}
            isLoadingClients={state.isLoadingClients}
            onOpenClientModal={() => state.setIsClientModalOpen(true)}
            galleryPassword={state.galleryPassword}
            setGalleryPassword={state.setGalleryPassword}
            sessionName={state.sessionName}
            setSessionName={state.setSessionName}
            expirationDays={state.expirationDays}
            setExpirationDays={state.setExpirationDays}
            subtitle={state.subtitle}
            setSubtitle={state.setSubtitle}
            category={state.category}
            setCategory={state.setCategory}
            eventDate={state.eventDate}
            setEventDate={state.setEventDate}
          />
        );

      case 2:
        return (
          <DeliverCreateStep2Visual
            sessionFont={state.sessionFont}
            setSessionFont={state.setSessionFont}
            sessionName={state.sessionName}
            titleCaseMode={state.titleCaseMode}
            setTitleCaseMode={state.setTitleCaseMode}
            useCustomTheme={state.useCustomTheme}
            setUseCustomTheme={state.setUseCustomTheme}
            activeThemeId={state.activeThemeId}
            setActiveThemeId={state.setActiveThemeId}
            themeOverrides={state.themeOverrides}
            setThemeOverrides={state.setThemeOverrides}
            coverId={state.coverId}
            setCoverId={state.setCoverId}
            settings={state.settings}
            photoSpacing={state.photoSpacing}
            setPhotoSpacing={state.setPhotoSpacing}
            clientMode={state.clientMode}
            setClientMode={state.setClientMode}
          />
        );

      case 3:
        return (
          <DeliverCreateStep3Photos
            supabaseGalleryId={state.supabaseGalleryId}
            activeFolderId={state.activeFolderId}
            setActiveFolderId={state.setActiveFolderId}
            storageLimitBytes={storageLimitBytes}
            storageUsedBytes={storageUsedBytes}
            onUploadComplete={actions.handleUploadComplete}
            setIsUploading={state.setIsUploading}
            photoRefreshKey={state.photoRefreshKey}
            coverPhotoId={state.coverPhotoId}
            onCoverChange={actions.handleCoverChange}
            onPhotosChange={state.setPhotoCount}
          />
        );

      case 4:
        return (
          <DeliverCreateStep4Message
            welcomeMessageEnabled={state.welcomeMessageEnabled}
            setWelcomeMessageEnabled={state.setWelcomeMessageEnabled}
            welcomeMessage={state.welcomeMessage}
            setWelcomeMessage={state.setWelcomeMessage}
            sessionName={state.sessionName}
            selectedClient={state.selectedClient}
            galleryPermission={state.galleryPermission}
            photoCount={state.photoCount}
            uploadedPhotosCount={state.uploadedPhotos.length}
          />
        );

      default:
        return null;
    }
  };

  return (
    <div className="max-w-[79rem] mx-auto w-full bg-background px-3 sm:px-4 lg:px-6 py-4 sm:py-6 space-y-4 sm:space-y-6 pb-32 sm:pb-36 animate-fade-in">
      <DeliverCreateHeader currentStep={state.currentStep} />

      <div className="lunari-card p-6 md:p-8 mb-6 border border-border/60 dark:border-border/40 shadow-sm rounded-2xl">
        {renderStep()}
      </div>

      <DeliverCreateFooter
        currentStep={state.currentStep}
        stepsCount={actions.stepsCount}
        isCreatingGallery={state.isCreatingGallery}
        isUploading={state.isUploading}
        isPublishing={state.isPublishing}
        photoCount={state.photoCount}
        uploadedPhotosCount={state.uploadedPhotos.length}
        onBack={actions.handleBack}
        onNext={actions.handleNext}
        onPublish={actions.handlePublish}
      />

      <ClientModal
        open={state.isClientModalOpen}
        onOpenChange={state.setIsClientModalOpen}
        onSave={actions.handleClientCreate}
      />
    </div>
  );
}
