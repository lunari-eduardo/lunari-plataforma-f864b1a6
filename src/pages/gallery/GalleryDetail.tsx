import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AlertCircle, Clock, Loader2, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Lightbox } from '@/components/Lightbox';
import { ActionTimeline } from '@/components/ActionTimeline';
import { PhotoCodesModal } from '@/components/PhotoCodesModal';
import { SendGalleryModal } from '@/components/SendGalleryModal';
import { ReactivateGalleryDialog } from '@/components/ReactivateGalleryDialog';
import { ReactivateSuccessModal } from '@/components/ReactivateSuccessModal';
import { useSettings } from '@/hooks/useSettings';
import { useQueryClient } from '@tanstack/react-query';

import { useGalleryDetailData } from './detail/hooks/useGalleryDetailData';
import { useGalleryVisitors } from './detail/hooks/useGalleryVisitors';
import { useGalleryDetailActions } from './detail/hooks/useGalleryDetailActions';

import { DetailHeader } from './detail/components/DetailHeader';
import { PhotosTab } from './detail/components/PhotosTab';
import { SelectionTab } from './detail/components/SelectionTab';
import { VisitorsTab } from './detail/components/VisitorsTab';
import { DetailsTab } from './detail/components/DetailsTab';

export default function GalleryDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { settings } = useSettings();

  const [activeTab, setActiveTab] = useState<string>('selection');
  const [activePhotoFilter, setActivePhotoFilter] = useState<string>('all');

  // 1. Data Hook
  const data = useGalleryDetailData({
    id,
    defaultPhotoSpacing: settings?.defaultPhotoSpacing,
  });

  // 2. Visitors Hook (Public galleries)
  const isPublicGallery = data.supabaseGallery?.permissao === 'public';
  const visitors = useGalleryVisitors({
    id,
    isPublicGallery,
  });

  // 3. Actions & Modals Hook
  const actions = useGalleryDetailActions({
    galleryId: data.supabaseGallery?.id,
    sendSupabaseGallery: data.sendSupabaseGallery,
    reopenSupabaseSelection: data.reopenSupabaseSelection,
    deleteSupabaseGallery: data.deleteSupabaseGallery,
  });

  // Loading state
  if (data.isLoadingData) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="text-muted-foreground">Carregando galeria...</p>
        </div>
      </div>
    );
  }

  // Not found state
  if (!data.supabaseGallery) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <AlertCircle className="h-12 w-12 text-destructive mb-4" />
        <h2 className="text-2xl font-bold mb-2">Galeria não encontrada</h2>
        <p className="text-muted-foreground mb-4">
          A galeria solicitada não existe ou foi removida.
        </p>
        <Button variant="outline" onClick={() => navigate('/app/gallery/list')}>
          Voltar ao Dashboard
        </Button>
      </div>
    );
  }

  const handleStatusUpdated = () => {
    queryClient.invalidateQueries({ queryKey: ['galleries'] });
    queryClient.invalidateQueries({ queryKey: ['galerias'] });
    queryClient.invalidateQueries({ queryKey: ['galeria-cobrancas-pagas'] });
    queryClient.invalidateQueries({ queryKey: ['galeria-cobranca-pendente'] });
    data.refetchCobrancas();
    data.refetchCobranca();
  };

  return (
    <div className="max-w-[79rem] mx-auto w-full bg-background px-3 sm:px-4 lg:px-6 py-4 sm:py-6 space-y-4 sm:space-y-6 pb-[max(4rem,env(safe-area-inset-bottom))] animate-fade-in">
      {/* Header — Identificação + Informações + Ações */}
      <DetailHeader
        supabaseGallery={data.supabaseGallery}
        effectiveStatus={data.effectiveStatus}
        effectiveClienteId={data.effectiveClienteId}
        calculatedExtraTotal={data.calculatedExtraTotal}
        canReactivate={data.canReactivate}
        deadline={data.deadline}
        onReactivateClick={() => actions.setReactivateOpen(true)}
        onShareClick={() => actions.setIsSendModalOpen(true)}
        onDeleteGallery={actions.handleDeleteGallery}
        onDetailsTabClick={() => setActiveTab('details')}
        mobileMenuOpen={actions.mobileMenuOpen}
        setMobileMenuOpen={actions.setMobileMenuOpen}
        deleteDialogOpen={actions.deleteDialogOpen}
        setDeleteDialogOpen={actions.setDeleteDialogOpen}
      />

      {/* PIX Manual Payment Confirmation Banner */}
      {data.supabaseGallery.statusPagamento === 'aguardando_confirmacao' && (
        <div className="p-4 rounded-lg bg-amber-50 border border-amber-200 dark:bg-amber-900/20 dark:border-amber-800">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
              <div>
                <p className="font-medium text-amber-800 dark:text-amber-200">
                  Aguardando confirmação de pagamento PIX
                </p>
                <p className="text-sm text-amber-600 dark:text-amber-400">
                  Valor: R$ {(data.supabaseGallery.valorExtras || data.calculatedExtraTotal).toFixed(2)}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList>
          <TabsTrigger value="photos">Fotos ({data.transformedPhotos.length})</TabsTrigger>
          <TabsTrigger value="selection">Seleção ({data.selectedPhotos.length})</TabsTrigger>
          {isPublicGallery && (
            <TabsTrigger value="visitors">
              <Users className="h-4 w-4 mr-1" />
              Visitantes ({visitors.visitorsData?.visitors?.length || 0})
            </TabsTrigger>
          )}
          <TabsTrigger value="details">Detalhes</TabsTrigger>
          <TabsTrigger value="history">Histórico</TabsTrigger>
        </TabsList>

        <TabsContent value="photos" className="space-y-4">
          <PhotosTab
            transformedPhotos={data.transformedPhotos}
            selectedPhotos={data.selectedPhotos}
            favoritePhotos={data.favoritePhotos}
            galleryFolders={data.galleryFolders}
            activePhotoFilter={activePhotoFilter}
            setActivePhotoFilter={setActivePhotoFilter}
            photoSpacing={data.supabaseGallery.configuracoes?.photoSpacing ?? settings?.defaultPhotoSpacing ?? data.galleryForSummary?.settings.photoSpacing ?? 6}
            allowComments={data.supabaseGallery.configuracoes?.allowComments ?? true}
            onViewFullscreen={(index) => actions.setLightboxState({ source: 'filtered', index })}
          />
        </TabsContent>

        <TabsContent value="selection" className="space-y-6">
          <SelectionTab
            isPublicGallery={isPublicGallery}
            supabaseGallery={data.supabaseGallery}
            selectedPhotos={data.selectedPhotos}
            favoritePhotos={data.favoritePhotos}
            extrasNecessarias={data.extrasNecessarias}
            extrasPagasTotal={data.extrasPagasTotal}
            extrasACobrar={data.extrasACobrar}
            calculatedExtraTotal={data.calculatedExtraTotal}
            cobrancaData={data.cobrancaData}
            isCodeCopied={actions.isCodeCopied}
            onCopyCode={actions.handleCopyCode}
            onViewPhotosClick={() => {
              setActivePhotoFilter('selected');
              setActiveTab('photos');
            }}
            onDetailsTabClick={() => setActiveTab('details')}
            onStatusUpdated={handleStatusUpdated}
          />
        </TabsContent>

        {isPublicGallery && (
          <TabsContent value="visitors" className="space-y-4">
            <VisitorsTab
              isLoadingVisitors={visitors.isLoadingVisitors}
              visitors={visitors.visitorsData?.visitors || []}
              expandedVisitorId={visitors.expandedVisitorId}
              setExpandedVisitorId={visitors.setExpandedVisitorId}
              visitorPhotosMap={visitors.visitorPhotosMap}
              loadingVisitorPhotos={visitors.loadingVisitorPhotos}
              fetchVisitorPhotos={visitors.fetchVisitorPhotos}
              setVisitorCodesModalId={visitors.setVisitorCodesModalId}
            />
          </TabsContent>
        )}

        <TabsContent value="details">
          <DetailsTab
            supabaseGallery={data.supabaseGallery}
            effectiveClienteId={data.effectiveClienteId}
            deadline={data.deadline}
            valorUnitario={data.valorUnitario}
            calculatedExtraTotal={data.calculatedExtraTotal}
            extrasACobrar={data.extrasACobrar}
            cobrancasPagas={data.cobrancasPagas}
            cobrancaData={data.cobrancaData}
            onStatusUpdated={handleStatusUpdated}
          />
        </TabsContent>

        <TabsContent value="history">
          <div className="lunari-card p-5">
            <h3 className="font-medium mb-4">Histórico de Ações</h3>
            <ActionTimeline actions={data.actions} />
          </div>
        </TabsContent>
      </Tabs>

      {/* Lightbox */}
      {actions.lightboxState !== null && (
        <Lightbox
          photos={
            actions.lightboxState.source === 'selection'
              ? data.selectedPhotos
              : actions.lightboxState.source === 'filtered'
                ? (activePhotoFilter === 'selected' 
                    ? data.transformedPhotos.filter(p => p.isSelected)
                    : activePhotoFilter === 'favorites'
                      ? data.transformedPhotos.filter(p => p.isSelected && p.isFavorite)
                      : activePhotoFilter.startsWith('folder:')
                        ? data.transformedPhotos.filter(p => p.folderId === activePhotoFilter.replace('folder:', ''))
                        : data.transformedPhotos)
                : data.transformedPhotos
          }
          currentIndex={actions.lightboxState.index}
          allowComments={data.supabaseGallery.configuracoes?.allowComments ?? true}
          disabled
          onClose={() => actions.setLightboxState(null)}
          onNavigate={(idx) => actions.setLightboxState((prev) => prev ? { ...prev, index: idx } : prev)}
          onSelect={() => {}}
        />
      )}

      {/* Photo Codes Modal */}
      <PhotoCodesModal
        open={actions.isCodesModalOpen}
        onOpenChange={actions.setIsCodesModalOpen}
        photos={data.transformedPhotos}
        clientName={data.supabaseGallery.clienteNome || 'Cliente'}
        folders={data.galleryFolders}
      />

      {/* Visitor Photo Codes Modal */}
      {visitors.visitorCodesModalId && visitors.visitorPhotosMap[visitors.visitorCodesModalId] && (
        <PhotoCodesModal
          open={!!visitors.visitorCodesModalId}
          onOpenChange={(open) => { if (!open) visitors.setVisitorCodesModalId(null); }}
          photos={visitors.visitorPhotosMap[visitors.visitorCodesModalId]}
          clientName={visitors.visitorsData?.visitors?.find((v: any) => v.id === visitors.visitorCodesModalId)?.nome || 'Visitante'}
        />
      )}

      {/* Send Gallery Modal */}
      <SendGalleryModal
        isOpen={actions.isSendModalOpen}
        onOpenChange={actions.setIsSendModalOpen}
        gallery={data.supabaseGallery}
        settings={settings}
        onSendGallery={actions.handleSendGallery}
      />

      {/* Reactivate Gallery Dialog */}
      <ReactivateGalleryDialog
        open={actions.reactivateOpen}
        onOpenChange={actions.setReactivateOpen}
        galleryName={data.supabaseGallery.nomeSessao || 'Esta galeria'}
        onReactivate={actions.handleReopenSelection}
        onSuccess={(days) => {
          actions.setReactivateDays(days);
          actions.setReactivateSuccessOpen(true);
        }}
      />

      {/* Reactivate Success / Share Modal */}
      {settings && (
        <ReactivateSuccessModal
          isOpen={actions.reactivateSuccessOpen}
          onOpenChange={actions.setReactivateSuccessOpen}
          gallery={data.supabaseGallery}
          settings={settings}
          clientLink={data.clientLink}
          newDeadline={(() => {
            const d = new Date();
            d.setDate(d.getDate() + actions.reactivateDays);
            return d;
          })()}
          daysGranted={actions.reactivateDays}
        />
      )}
    </div>
  );
}
