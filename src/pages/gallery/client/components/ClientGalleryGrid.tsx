import React, { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { RowMasonryGrid as MasonryGrid, RowMasonryItem as MasonryItem } from '@/components/RowMasonryGrid';
import { PhotoCard } from '@/components/PhotoCard';
import { Lightbox } from '@/components/Lightbox';
import { SelectionSummary } from '@/components/SelectionSummary';
import { ClientGalleryHeader, FilterMode } from '@/components/ClientGalleryHeader';
import { GalleryWelcomeModal } from '@/components/gallery/GalleryWelcomeModal';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Gallery, GalleryPhoto } from '@/types/gallery';
import { RegrasCongeladas } from '@/lib/pricingUtils';
import { getFontFamilyById } from '@/components/FontSelect';
import { cn } from '@/lib/utils';

interface ClientGalleryGridProps {
  gallery: Gallery;
  galleryResponse: any;
  supabaseGallery: any;
  localPhotos: GalleryPhoto[];
  displayPhotos: GalleryPhoto[];
  filterMode: FilterMode;
  onFilterChange: (mode: FilterMode) => void;
  hasFolders: boolean;
  galleryFolders: Array<{ id: string; nome: string }>;
  activeFolderId: string | null;
  setActiveFolderId: (id: string | null) => void;
  setFolderViewMode: (mode: 'albums' | 'grid') => void;
  visitorName: string | null;
  hasDeadline: boolean;
  hoursUntilDeadline: number;
  isNearDeadline: boolean;
  isExpired: boolean;
  isBlocked: boolean;
  isConfirmed: boolean;
  selectedCount: number;
  extraCount: number;
  extrasPagasTotal: number;
  extrasACobrar: number;
  extraTotal: number;
  valorJaPago: number;
  regrasCongeladas: RegrasCongeladas | null;
  toggleSelection: (photoId: string) => void;
  handleComment: (photoId: string, comment: string) => void;
  handleFavorite: (photoId: string) => void;
  handleStartConfirmation: () => void;
  showPartialSelectionDialog: boolean;
  setShowPartialSelectionDialog: (open: boolean) => void;
  onProceedPartialSelection: () => void;
  showWelcome: boolean;
  handleCloseWelcome: () => void;
  themeStyles: React.CSSProperties;
  effectiveBackgroundMode: 'light' | 'dark';
}

export function ClientGalleryGrid({
  gallery,
  galleryResponse,
  supabaseGallery,
  localPhotos,
  displayPhotos,
  filterMode,
  onFilterChange,
  hasFolders,
  galleryFolders,
  activeFolderId,
  setActiveFolderId,
  setFolderViewMode,
  visitorName,
  hasDeadline,
  hoursUntilDeadline,
  isNearDeadline,
  isExpired,
  isBlocked,
  isConfirmed,
  selectedCount,
  extraCount,
  extrasPagasTotal,
  extrasACobrar,
  extraTotal,
  valorJaPago,
  regrasCongeladas,
  toggleSelection,
  handleComment,
  handleFavorite,
  handleStartConfirmation,
  showPartialSelectionDialog,
  setShowPartialSelectionDialog,
  onProceedPartialSelection,
  showWelcome,
  handleCloseWelcome,
  themeStyles,
  effectiveBackgroundMode,
}: ClientGalleryGridProps) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const photoSpacing = supabaseGallery?.configuracoes?.photoSpacing 
    ?? galleryResponse?.settings?.photoSpacing 
    ?? gallery.settings.photoSpacing 
    ?? 8;

  return (
    <div 
      className={cn(
        "min-h-screen flex flex-col bg-background text-foreground gallery-protected",
        effectiveBackgroundMode === 'dark' && 'dark'
      )}
      style={themeStyles}
    >
      <ClientGalleryHeader
        sessionName={gallery.sessionName}
        sessionFont={getFontFamilyById(gallery.settings.sessionFont)}
        titleCaseMode={gallery.settings.titleCaseMode || 'normal'}
        totalPhotos={hasFolders && activeFolderId ? displayPhotos.length : localPhotos.length}
        deadline={hasDeadline ? gallery.settings.deadline : null}
        hasDeadline={hasDeadline}
        hoursUntilDeadline={hoursUntilDeadline}
        isNearDeadline={isNearDeadline}
        isExpired={isExpired}
        isConfirmed={isConfirmed}
        selectedCount={selectedCount}
        includedPhotos={gallery.includedPhotos}
        extraCount={extraCount}
        extrasPagasAnteriormente={extrasPagasTotal}
        extrasACobrar={extrasACobrar}
        studioLogoUrl={galleryResponse?.studioSettings?.studio_logo_url}
        studioName={galleryResponse?.studioSettings?.studio_name}
        contactEmail={null}
        filterMode={filterMode}
        onFilterChange={onFilterChange}
        favoritesCount={localPhotos.filter(p => p.isFavorite).length}
      />

      {visitorName && (
        <div className="bg-primary/5 border-b border-primary/10 px-4 py-2 text-center">
          <p className="text-xs text-muted-foreground">
            Olá, <span className="font-medium text-foreground">{visitorName}</span> — você está selecionando suas fotos
          </p>
        </div>
      )}

      {hasFolders && activeFolderId && (
        <div className="bg-background border-b border-border/30 px-3 py-2">
          <div className="flex items-center gap-2 overflow-x-auto">
            <button
              onClick={() => {
                setActiveFolderId(null);
                setFolderViewMode('albums');
              }}
              className="shrink-0 px-3 py-1 rounded-lg text-xs font-medium border border-border text-muted-foreground hover:bg-muted transition-colors inline-flex items-center gap-1.5"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Álbuns
            </button>
            {galleryFolders.map((f) => {
              const isActive = f.id === activeFolderId;
              const count = localPhotos.filter(p => p.folderId === f.id).length;
              return (
                <button
                  key={f.id}
                  onClick={() => setActiveFolderId(f.id)}
                  className={cn(
                    'shrink-0 px-3 py-1 rounded-lg text-xs font-medium transition-colors border',
                    isActive 
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'border-border text-muted-foreground hover:bg-muted'
                  )}
                >
                  {f.nome} ({count})
                </button>
              );
            })}
          </div>
        </div>
      )}

      <main 
        className="flex-1 py-2 pb-28" 
        style={{ '--masonry-gap': `${photoSpacing}px` } as React.CSSProperties}
      >
        <MasonryGrid gap={photoSpacing}>
          {displayPhotos.map((photo) => {
            const originalIndex = localPhotos.findIndex(p => p.id === photo.id);
            return (
              <MasonryItem key={photo.id} photoWidth={photo.width} photoHeight={photo.height}>
                <PhotoCard
                  photo={photo}
                  isSelected={photo.isSelected}
                  allowComments={gallery.settings.allowComments}
                  disabled={isBlocked}
                  onSelect={() => toggleSelection(photo.id)}
                  onViewFullscreen={() => setLightboxIndex(originalIndex)}
                  onComment={() => {}}
                  onFavorite={() => handleFavorite(photo.id)}
                />
              </MasonryItem>
            );
          })}
        </MasonryGrid>
      </main>

      {lightboxIndex === null && (
        <SelectionSummary 
          gallery={{
            ...gallery,
            selectedCount,
            extraCount,
            extraTotal,
            selectionStatus: isConfirmed ? 'confirmed' : 'in_progress',
          }}
          onConfirm={handleStartConfirmation}
          isClient
          variant="bottom-bar"
          regrasCongeladas={regrasCongeladas}
          extrasPagasTotal={extrasPagasTotal}
          extrasACobrar={extrasACobrar}
          valorJaPago={valorJaPago}
          saleSettings={gallery.saleSettings}
          hasPayment={gallery.saleSettings?.mode === 'sale_with_payment' && (extrasACobrar ?? 0) > 0}
        />
      )}

      {lightboxIndex !== null && (() => {
        const lightboxPhotos = (hasFolders && activeFolderId) ? displayPhotos : localPhotos;
        const lightboxIdx = (hasFolders && activeFolderId)
          ? displayPhotos.findIndex((_, i) => {
              const originalIdx = localPhotos.findIndex(p => p.id === displayPhotos[i]?.id);
              return originalIdx === lightboxIndex;
            })
          : lightboxIndex;
        const actualIdx = lightboxIdx >= 0 ? lightboxIdx : 0;
        return (
          <Lightbox
            photos={lightboxPhotos}
            currentIndex={actualIdx}
            allowComments={gallery.settings.allowComments}
            allowDownload={gallery.settings.allowDownload}
            disabled={isBlocked}
            onClose={() => setLightboxIndex(null)}
            onNavigate={(idx) => {
              if (hasFolders && activeFolderId) {
                const photo = lightboxPhotos[idx];
                if (photo) {
                  const origIdx = localPhotos.findIndex(p => p.id === photo.id);
                  setLightboxIndex(origIdx >= 0 ? origIdx : idx);
                }
              } else {
                setLightboxIndex(idx);
              }
            }}
            onSelect={(photoId) => toggleSelection(photoId)}
            onComment={handleComment}
            onFavorite={handleFavorite}
          />
        );
      })()}

      <AlertDialog open={showPartialSelectionDialog} onOpenChange={setShowPartialSelectionDialog}>
        <AlertDialogContent style={themeStyles}>
          <AlertDialogHeader>
            <AlertDialogTitle>Seleção abaixo do pacote</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>
                Seu pacote inclui <strong>{gallery.includedPhotos}</strong> fotos, mas você selecionou apenas{' '}
                <strong>{localPhotos.filter(p => p.isSelected).length}</strong>.
              </p>
              <p>As fotos não selecionadas não poderão ser recuperadas depois.</p>
              <p>Deseja confirmar mesmo assim?</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar e selecionar mais</AlertDialogCancel>
            <AlertDialogAction onClick={onProceedPartialSelection}>
              Sim, confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {gallery.settings?.welcomeMessage && (
        <GalleryWelcomeModal
          open={showWelcome}
          onClose={handleCloseWelcome}
          message={gallery.settings.welcomeMessage}
          sessionName={gallery.sessionName}
          clientName={gallery.clientName}
          studioName={galleryResponse?.studioSettings?.studio_name}
          isDark={effectiveBackgroundMode === 'dark'}
        />
      )}
    </div>
  );
}
