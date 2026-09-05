import { useNavigate } from 'react-router-dom';
import { Loader2, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { getGalleryUrl } from '@/lib/galleryUrl';
import { SendDeliverEmailModal } from '@/components/deliver/SendDeliverEmailModal';

import { getDeliverStatusInfo } from './deliver/detail/types';
import { useDeliverDetailData } from './deliver/detail/hooks/useDeliverDetailData';
import { useDeliverDetailActions } from './deliver/detail/hooks/useDeliverDetailActions';
import { DeliverHeader } from './deliver/detail/components/DeliverHeader';
import { DeliverShareTab } from './deliver/detail/components/DeliverShareTab';
import { DeliverPhotosTab } from './deliver/detail/components/DeliverPhotosTab';
import { DeliverDesignTab } from './deliver/detail/components/DeliverDesignTab';
import { DeliverDetailsTab } from './deliver/detail/components/DeliverDetailsTab';

export default function DeliverDetail() {
  const navigate = useNavigate();
  const data = useDeliverDetailData();
  const actions = useDeliverDetailActions(data);

  if (data.galleriesLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data.gallery) {
    return (
      <div className="text-center py-24">
        <h2 className="text-2xl font-bold mb-2">Galeria não encontrada</h2>
        <Button variant="outline" onClick={() => navigate('/app/gallery/list?tab=transfer')}>
          Voltar
        </Button>
      </div>
    );
  }

  const statusInfo = getDeliverStatusInfo(data.gallery.status, data.gallery.prazoSelecao);
  const isDraft = statusInfo.label === 'Rascunho';
  const isExpired = statusInfo.label === 'Expirada';
  const galleryUrl = data.gallery.publicToken ? getGalleryUrl(data.gallery.publicToken) : '';

  return (
    <div className="max-w-[79rem] mx-auto w-full bg-background px-3 sm:px-4 lg:px-6 py-4 sm:py-6 space-y-4 sm:space-y-6 pb-[max(4rem,env(safe-area-inset-bottom))] animate-fade-in">
      <DeliverHeader
        gallery={data.gallery}
        photosCount={data.photos.length}
        effectiveClienteId={data.effectiveClienteId}
        statusInfo={statusInfo}
        isDraft={isDraft}
        isExpired={isExpired}
        isPublishing={actions.isPublishing}
        galleryUrl={galleryUrl}
        settings={data.settings}
        showReactivateDialog={actions.showReactivateDialog}
        setShowReactivateDialog={actions.setShowReactivateDialog}
        reactivateSuccessOpen={actions.reactivateSuccessOpen}
        setReactivateSuccessOpen={actions.setReactivateSuccessOpen}
        reactivateDays={actions.reactivateDays}
        setReactivateDays={actions.setReactivateDays}
        setExpirationDate={data.setExpirationDate}
        updateGallery={data.updateGallery}
        onPublish={actions.handlePublish}
        onDelete={actions.handleDelete}
      />

      <Tabs defaultValue="share">
        <TabsList className="w-full justify-start">
          <TabsTrigger value="share">Compartilhamento</TabsTrigger>
          <TabsTrigger value="photos">Fotos</TabsTrigger>
          <TabsTrigger value="design">Design & Temas</TabsTrigger>
          <TabsTrigger value="details">Detalhes</TabsTrigger>
        </TabsList>

        <TabsContent value="share">
          <DeliverShareTab
            isDraft={isDraft}
            isPublishing={actions.isPublishing}
            isLinkCopied={actions.isLinkCopied}
            galleryUrl={galleryUrl}
            publicToken={data.gallery.publicToken}
            shareMessage={data.shareMessage}
            setShareMessage={data.setShareMessage}
            onPublish={actions.handlePublish}
            onCopyLink={actions.copyToClipboard}
            onOpenWhatsApp={actions.openWhatsApp}
            onOpenEmailModal={() => actions.setShowEmailModal(true)}
          />
        </TabsContent>

        <TabsContent value="photos">
          <DeliverPhotosTab
            galleryId={data.id!}
            photos={data.photos}
            photosLoading={data.photosLoading}
            coverPhotoId={data.coverPhotoId}
            activeThemeId={data.activeThemeId}
            showUploader={actions.showUploader}
            setShowUploader={actions.setShowUploader}
            storageLimitBytes={data.transferStorage.storageLimitBytes}
            storageUsedBytes={data.transferStorage.storageUsedBytes}
            onUploadComplete={actions.handleUploadComplete}
            onToggleHighlight={actions.handleToggleHighlight}
            onSetCover={actions.handleSetCover}
            onDeletePhoto={actions.handlePhotoDelete}
          />
        </TabsContent>

        <TabsContent value="design">
          <DeliverDesignTab
            useCustomTheme={data.useCustomTheme}
            setUseCustomTheme={data.setUseCustomTheme}
            activeThemeId={data.activeThemeId}
            setActiveThemeId={data.setActiveThemeId}
            themeOverrides={data.themeOverrides}
            setThemeOverrides={data.setThemeOverrides}
            coverId={data.coverId}
            setCoverId={data.setCoverId}
            previewViewport={data.previewViewport}
            setPreviewViewport={data.setPreviewViewport}
            photos={data.photos}
            publicToken={data.gallery.publicToken}
            saving={actions.saving}
            onSave={actions.handleSave}
          />
        </TabsContent>

        <TabsContent value="details">
          <DeliverDetailsTab
            gallery={data.gallery}
            effectiveClienteId={data.effectiveClienteId}
            sessionName={data.sessionName}
            setSessionName={data.setSessionName}
            subtitle={data.subtitle}
            setSubtitle={data.setSubtitle}
            category={data.category}
            setCategory={data.setCategory}
            eventDate={data.eventDate}
            setEventDate={data.setEventDate}
            internalNotes={data.internalNotes}
            setInternalNotes={data.setInternalNotes}
            isPrivate={data.isPrivate}
            setIsPrivate={data.setIsPrivate}
            galleryPassword={data.galleryPassword}
            setGalleryPassword={data.setGalleryPassword}
            expirationDate={data.expirationDate}
            setExpirationDate={data.setExpirationDate}
            welcomeEnabled={data.welcomeEnabled}
            setWelcomeEnabled={data.setWelcomeEnabled}
            welcomeMessage={data.welcomeMessage}
            setWelcomeMessage={data.setWelcomeMessage}
          />
        </TabsContent>
      </Tabs>

      <SendDeliverEmailModal
        isOpen={actions.showEmailModal}
        onOpenChange={actions.setShowEmailModal}
        gallery={data.gallery}
        photosCount={data.photos.length}
        galleryUrl={galleryUrl}
      />

      <div className="fixed bottom-6 right-6 z-50">
        <Button
          onClick={actions.handleSave}
          disabled={actions.saving}
          variant="terracotta"
          size="lg"
          className="shadow-2xl gap-2 rounded-full px-6 h-12 backdrop-blur-xl"
        >
          {actions.saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {actions.saving ? 'Salvando...' : 'Salvar Alterações'}
        </Button>
      </div>
    </div>
  );
}
